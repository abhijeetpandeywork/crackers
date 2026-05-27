import { Router } from "express";
import { db, estimatesTable, productsTable, settingsTable, discountMatricesTable, customersTable, invoicesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod/v4";
import multer from "multer";
import * as XLSX from "xlsx";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { SALES_WRITE } from "../../lib/auth-roles.js";
import { resolvePrice, type PricingChannel } from "../../lib/pricing.js";
import { nextEstimateNo } from "../../lib/counter.js";
import { auditWrite } from "../../lib/audit.js";
import { getTaxConfig, computeTax } from "../../lib/tax.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB sheet limit
});

const createEstimateSchema = z.object({
  type: z.enum(["WHOLESALE", "RETAIL", "AGENT"]),
  customerId: z.string().optional(),
  agentId: z.string().optional(),
  priceListId: z.string().optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  taxMode: z.enum(["inclusive", "exclusive"]).default("exclusive"),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().min(1),
    qty: z.number().positive(),
  })).min(1, "At least one item is required"),
});

async function getWholesaleThreshold(): Promise<number> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "pricing")).limit(1);
  if (rows[0]) {
    const val = rows[0].value as any;
    if (val?.wholesaleQtyThreshold) return Number(val.wholesaleQtyThreshold);
  }
  return 10;
}

router.get("/estimates", authenticate, async (req, res) => {
  const { type, customerId, agentId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, parseInt(limit));
  const offset = (pg - 1) * lim;
  const conditions = [];
  if (type) conditions.push(eq(estimatesTable.type, type as any));
  if (customerId) conditions.push(eq(estimatesTable.customerId, customerId));
  if (agentId) conditions.push(eq(estimatesTable.agentId, agentId));
  if (status) conditions.push(eq(estimatesTable.status, status as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(estimatesTable).where(where).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(estimatesTable).where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ success: true, data: rows, meta: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) } });
});

router.post("/estimates", authenticate, requireRole(...SALES_WRITE), async (req: AuthRequest, res) => {
  const parsed = createEstimateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: z.prettifyError(parsed.error) } });
    return;
  }
  const { type, customerId, agentId, priceListId, couponCode, items, notes, taxMode } = parsed.data;

  const threshold = await getWholesaleThreshold();
  const channel: PricingChannel = type === "WHOLESALE" ? "WHOLESALE" : type === "AGENT" ? "AGENT" : "RETAIL";

  // Fetch active category/brand discount matrices
  const activeMatrices = await db.select().from(discountMatricesTable).where(eq(discountMatricesTable.isActive, true));

  let customerName: string | null = null;
  let interstate = false;
  if (customerId) {
    const cRows = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    const cust = cRows[0];
    if (cust) {
      customerName = cust.name;
      const st = cust.state?.trim().toLowerCase();
      if (st && st !== "tn" && st !== "tamil nadu" && st !== "tamilnadu") {
        interstate = true;
      }
    }
  }

  const resolvedItems = [];
  for (const item of items) {
    const rows = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    const product = rows[0];
    if (!product) continue;
    const variants = (product.variants ?? []) as any[];
    const variant = variants.find((v: any) => v.variantId === item.variantId);
    if (!variant) continue;
    const priceResult = resolvePrice(variant, item.qty, channel, threshold, {
      category: product.category,
      brandId: variant.brand,
      discountMatrices: activeMatrices,
    });
    const amount = priceResult.resolvedPrice * item.qty;
    resolvedItems.push({
      productId: item.productId,
      productName: product.name,
      variantId: item.variantId,
      variantSize: variant.size ?? "",
      qty: item.qty,
      resolvedPrice: priceResult.resolvedPrice,
      resolutionReason: priceResult.resolutionReason,
      bulkRateApplied: priceResult.bulkRateApplied,
      amount,
      gstRate: product.gstRate ?? null,
      hsnCode: product.hsnCode ?? null,
    });
  }

  const subtotal = resolvedItems.reduce((s, i) => s + i.amount, 0);
  const taxLines = resolvedItems.map(i => ({ amount: i.amount, product: { gstRate: i.gstRate, hsnCode: i.hsnCode } }));
  const taxConfig = await getTaxConfig();
  const tx = computeTax(taxLines, 0, taxConfig, interstate, taxMode === "inclusive");

  const estimateNo = await nextEstimateNo();

  const [estimate] = await db.insert(estimatesTable).values({
    id: crypto.randomUUID(),
    estimateNo,
    type,
    customerId,
    customerName,
    agentId,
    priceListId,
    items: resolvedItems,
    subtotal: subtotal.toFixed(2),
    taxMode: taxMode,
    taxableAmount: tx.taxable.toFixed(2),
    cgst: tx.cgst.toFixed(2),
    sgst: tx.sgst.toFixed(2),
    igst: tx.igst.toFixed(2),
    total: tx.total.toFixed(2),
    couponCode,
    status: "draft",
    notes,
    createdBy: req.user?.id,
  }).returning();

  await auditWrite(req, { action: "CREATE", entityType: "estimate", entityId: estimate?.id, after: estimate });
  res.status(201).json(estimate);
});

function findHeaderRow(rows: any[][]): { headers: string[]; headerRowIdx: number } {
  let headers: string[] = [];
  let headerRowIdx = 0;

  // Look for a row containing typical headers first
  for (let idx = 0; idx < Math.min(rows.length, 25); idx++) {
    const row = rows[idx];
    if (!Array.isArray(row)) continue;
    const stringRow = row.map(c => c === null || c === undefined ? "" : String(c).trim().toLowerCase());
    
    const hasCode = stringRow.some(s => s === "code" || s.includes("code") || s.includes("art-no") || s.includes("art no") || s === "id" || s.includes("product code") || s.includes("item code"));
    const hasQty = stringRow.some(s => s === "qty" || s.includes("qty") || s.includes("quantity") || s.includes("needed") || s.includes("pcs") || s.includes("pcs required") || s.includes("order qty"));
    const hasName = stringRow.some(s => s === "name" || s.includes("name") || s.includes("product") || s.includes("description") || s.includes("item"));
    
    if ((hasCode && hasQty) || (hasCode && hasName) || (hasName && hasQty)) {
      headers = row.map(c => c === null || c === undefined ? "" : String(c).trim());
      headerRowIdx = idx;
      return { headers, headerRowIdx };
    }
  }

  // Fallback to the first non-empty row with at least 2 non-empty values
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (Array.isArray(row)) {
      const nonCols = row.filter(c => c !== null && c !== undefined && String(c).trim() !== "");
      if (nonCols.length >= 2) {
        headers = row.map(c => c === null || c === undefined ? "" : String(c).trim());
        headerRowIdx = idx;
        return { headers, headerRowIdx };
      }
    }
  }

  return { headers: [], headerRowIdx: 0 };
}

router.post("/estimates/bulk-parse", authenticate, upload.single("file"), async (req: AuthRequest, res) => {
  const file = (req as any).file;
  if (!file) {
    res.status(400).json({ success: false, error: { code: "NO_FILE", message: "Attach spreadsheet file in 'file' field." } });
    return;
  }

  try {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const { format, customerId, type = "RETAIL", sheetName: requestedSheet } = req.body;
    const headersOnly = req.query.headers === "true" || req.body.headersOnly === "true";

    const sheetNames = workbook.SheetNames;
    const sheetName = requestedSheet || sheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      res.status(400).json({ success: false, error: { code: "INVALID_SHEET", message: `Worksheet "${sheetName}" not found.` } });
      return;
    }

    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (headersOnly) {
      const { headers } = findHeaderRow(rows);
      res.json({
        success: true,
        sheets: sheetNames,
        headers,
        selectedSheet: sheetName,
      });
      return;
    }

    const threshold = await getWholesaleThreshold();
    const channel: PricingChannel = type === "WHOLESALE" ? "WHOLESALE" : type === "AGENT" ? "AGENT" : "RETAIL";
    const activeMatrices = await db.select().from(discountMatricesTable).where(eq(discountMatricesTable.isActive, true));

    const matchedItems: any[] = [];
    const unmatchedItems: any[] = [];

    if (format === "brochure") {
      // Brochure format: Col A (Code) and Col F (Quantity) by default, or auto-detected indices
      let codeIndex = 0;
      let qtyIndex = 5; // index 5 is Col F
      let headerRowIdx = -1;

      // Extract headers to map columns and find header row dynamically (skips decorative top sheets)
      const { headers: rawHeaders, headerRowIdx: foundHeaderIdx } = findHeaderRow(rows);
      if (foundHeaderIdx !== -1 && rawHeaders.length > 0) {
        headerRowIdx = foundHeaderIdx;
        const headers = rawHeaders.map(h => h.toLowerCase());
        
        const foundCodeIdx = headers.findIndex(h => h === "code" || h.includes("code") || h.includes("art-no") || h.includes("art no") || h === "id" || h.includes("product code") || h.includes("item code"));
        const foundQtyIdx = headers.findIndex(h => h === "qty" || h.includes("qty") || h.includes("quantity") || h.includes("needed") || h.includes("pcs") || h.includes("pcs required") || h.includes("order qty"));
        
        if (foundCodeIdx !== -1) codeIndex = foundCodeIdx;
        if (foundQtyIdx !== -1) qtyIndex = foundQtyIdx;
      }

      // Loop after the header row, or from the first row if no header was detected
      const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

      for (let idx = startIdx; idx < rows.length; idx++) {
        const row = rows[idx];
        if (!Array.isArray(row)) continue;
        const codeRaw = row[codeIndex];
        const qtyRaw = row[qtyIndex];

        if (codeRaw === null || codeRaw === undefined || String(codeRaw).trim() === "") continue;

        const qty = parseInt(String(qtyRaw).trim());
        if (isNaN(qty) || qty <= 0) continue;

        const codeStr = String(codeRaw).trim().toUpperCase();
        const pRows = await db.select().from(productsTable).where(eq(productsTable.code, codeStr)).limit(1);
        let product = pRows[0];

        // Fallback: If not found by code, try matching by product name (case-insensitive)
        if (!product) {
          const nameCandidates = [row[codeIndex + 1], row[1]];
          for (const nameRaw of nameCandidates) {
            if (nameRaw !== null && nameRaw !== undefined && String(nameRaw).trim() !== "") {
              const nameStr = String(nameRaw).trim().toLowerCase();
              const allProducts = await db.select().from(productsTable);
              const matched = allProducts.find(p => p.name.trim().toLowerCase() === nameStr);
              if (matched) {
                product = matched;
                break;
              }
            }
          }
        }

        if (product) {
          const variants = (product.variants ?? []) as any[];
          const variant = variants[0]; // first variant
          if (variant) {
            const priceResult = resolvePrice(variant, qty, channel, threshold, {
              category: product.category,
              brandId: variant.brand,
              discountMatrices: activeMatrices,
            });
            matchedItems.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.variantId,
              variantSize: variant.size ?? "",
              qty,
              resolvedPrice: priceResult.resolvedPrice,
              resolutionReason: priceResult.resolutionReason,
              bulkRateApplied: priceResult.bulkRateApplied,
              amount: priceResult.resolvedPrice * qty,
              gstRate: product.gstRate ?? null,
              hsnCode: product.hsnCode ?? null,
            });
          } else {
            unmatchedItems.push({
              code: codeStr,
              name: product.name,
              qty,
              reason: "Product variant not configured."
            });
          }
        } else {
          unmatchedItems.push({
            code: codeStr,
            name: row[1] ? String(row[1]).trim() : "Unknown Product",
            qty,
            reason: "Code not found in catalog."
          });
        }
      }
    } else {
      // Manual column mapping mode
      const { codeColumn, qtyColumn } = req.body;
      if (codeColumn === undefined || qtyColumn === undefined) {
        res.status(400).json({ success: false, error: { code: "MAPPING_REQUIRED", message: "Mapping mode requires codeColumn and qtyColumn fields." } });
        return;
      }

      let codeIndex = -1;
      let qtyIndex = -1;

      // Extract headers to map string column names if supplied
      const { headers: rawHeaders, headerRowIdx } = findHeaderRow(rows);
      const headers = rawHeaders.map(h => h.toLowerCase());

      if (isNaN(Number(codeColumn))) {
        codeIndex = headers.indexOf(String(codeColumn).trim().toLowerCase());
        qtyIndex = headers.indexOf(String(qtyColumn).trim().toLowerCase());
      } else {
        codeIndex = Number(codeColumn);
        qtyIndex = Number(qtyColumn);
      }

      if (codeIndex === -1 || qtyIndex === -1) {
        res.status(400).json({ success: false, error: { code: "INVALID_MAPPING", message: "Could not find mapped columns in sheet headers." } });
        return;
      }

      // Loop after the header row
      for (let idx = headerRowIdx + 1; idx < rows.length; idx++) {
        const row = rows[idx];
        if (!Array.isArray(row)) continue;
        const codeRaw = row[codeIndex];
        const qtyRaw = row[qtyIndex];

        if (codeRaw === null || codeRaw === undefined || String(codeRaw).trim() === "") continue;

        const qty = parseInt(String(qtyRaw).trim());
        if (isNaN(qty) || qty <= 0) continue;

        const codeStr = String(codeRaw).trim().toUpperCase();
        const pRows = await db.select().from(productsTable).where(eq(productsTable.code, codeStr)).limit(1);
        const product = pRows[0];

        if (product) {
          const variants = (product.variants ?? []) as any[];
          const variant = variants[0];
          if (variant) {
            const priceResult = resolvePrice(variant, qty, channel, threshold, {
              category: product.category,
              brandId: variant.brand,
              discountMatrices: activeMatrices,
            });
            matchedItems.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.variantId,
              variantSize: variant.size ?? "",
              qty,
              resolvedPrice: priceResult.resolvedPrice,
              resolutionReason: priceResult.resolutionReason,
              bulkRateApplied: priceResult.bulkRateApplied,
              amount: priceResult.resolvedPrice * qty,
              gstRate: product.gstRate ?? null,
              hsnCode: product.hsnCode ?? null,
            });
          } else {
            unmatchedItems.push({
              code: codeStr,
              name: product.name,
              qty,
              reason: "Product variant not configured."
            });
          }
        } else {
          unmatchedItems.push({
            code: codeStr,
            name: row[codeIndex + 1] ? String(row[codeIndex + 1]).trim() : "Unknown Product",
            qty,
            reason: "Code not found in catalog."
          });
        }
      }
    }

    res.json({
      success: true,
      matchedItems,
      unmatchedItems
    });

  } catch (err: any) {
    req.log.error({ err }, "Spreadsheet parsing error");
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.get("/estimates/:id", authenticate, async (req, res) => {
  const rows = await db.select().from(estimatesTable).where(eq(estimatesTable.id, req.params["id"] as string)).limit(1);
  if (!rows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Estimate not found" } }); return; }
  res.json(rows[0]);
});

router.put("/estimates/:id/convert", authenticate, requireRole(...SALES_WRITE), async (req: AuthRequest, res) => {
  const estimateRows = await db.select().from(estimatesTable).where(eq(estimatesTable.id, req.params["id"] as string)).limit(1);
  if (!estimateRows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Estimate not found" } }); return; }
  const est = estimateRows[0];

  const { nextInvoiceNo } = await import("../../lib/counter.js");

  const invoiceNo = await nextInvoiceNo();
  const fy = new Date().getFullYear();
  const financialYear = `${fy}-${fy + 1}`;

  const total = Number(est.total);

  // Strictly inventory neutral: bypass appendLedger or location stock updates entirely!
  const [invoice] = await db.insert(invoicesTable).values({
    id: crypto.randomUUID(),
    invoiceNo,
    customerId: est.customerId ?? undefined,
    customerName: est.customerName ?? undefined,
    agentId: est.agentId ?? undefined,
    priceListId: est.priceListId ?? undefined,
    estimateId: est.id,
    items: est.items as any,
    subtotal: est.subtotal,
    discountAmount: "0",
    couponCode: est.couponCode ?? undefined,
    couponDiscount: est.couponDiscount ?? "0",
    taxMode: est.taxMode,
    taxableAmount: est.taxableAmount,
    cgst: est.cgst,
    sgst: est.sgst,
    igst: est.igst,
    total: est.total,
    paymentMode: (req.body.paymentMode ?? "CASH") as any,
    channel: est.type === "WHOLESALE" ? "WHOLESALE" : est.type === "AGENT" ? "AGENT" : "RETAIL",
    financialYear,
    status: req.body.paymentMode === "CREDIT" ? "credit" : "paid",
    createdBy: req.user?.id,
  }).returning();

  await db.update(estimatesTable).set({ status: "converted", convertedInvoiceId: invoice!.id }).where(eq(estimatesTable.id, est.id));

  // If credit, record outstanding details
  if (req.body.paymentMode === "CREDIT" && est.customerId) {
    const cRows = await db.select().from(customersTable).where(eq(customersTable.id, est.customerId)).limit(1);
    if (cRows[0]) {
      const newBalance = Number(cRows[0].outstandingBalance) + total;
      await db.update(customersTable).set({ outstandingBalance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(customersTable.id, est.customerId));
      
      const { creditLedgerTable } = await import("@workspace/db");
      await db.insert(creditLedgerTable).values({
        id: crypto.randomUUID(),
        customerId: est.customerId,
        type: "DEBIT",
        amount: total.toFixed(2),
        runningBalance: newBalance.toFixed(2),
        reference: invoiceNo,
        refType: "INVOICE",
        refId: invoice!.id,
      });
    }
  }

  res.json(invoice);
});

export default router;
