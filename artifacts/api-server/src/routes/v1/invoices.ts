import { Router } from "express";
import { db, invoicesTable, productsTable, customersTable, creditLedgerTable, loyaltyLedgerTable, settingsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, ilike, desc } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { nextInvoiceNo } from "../../lib/counter.js";
import { resolvePrice, type PricingChannel } from "../../lib/pricing.js";
import { appendLedger } from "../../lib/stockService.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const router = Router();

router.get("/invoices", authenticate, async (req, res) => {
  const { invoiceNo, customerId, agentId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, parseInt(limit));
  const offset = (pg - 1) * lim;
  const conditions = [];
  if (customerId) conditions.push(eq(invoicesTable.customerId, customerId));
  if (agentId) conditions.push(eq(invoicesTable.agentId, agentId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(invoicesTable).where(where).orderBy(desc(invoicesTable.createdAt)).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ success: true, data: rows, meta: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) } });
});

type InlineAddress = {
  name?: string; phone?: string; line1?: string; line2?: string | null;
  city?: string; state?: string; pincode?: string; landmark?: string | null;
};
function sanitizeAddress(a: unknown): InlineAddress | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  const required = ["name", "phone", "line1", "city", "state", "pincode"];
  if (!required.every((k) => typeof o[k] === "string" && (o[k] as string).trim() !== "")) return null;
  return {
    name: String(o["name"]),
    phone: String(o["phone"]),
    line1: String(o["line1"]),
    line2: o["line2"] == null ? null : String(o["line2"]),
    city: String(o["city"]),
    state: String(o["state"]),
    pincode: String(o["pincode"]),
    landmark: o["landmark"] == null ? null : String(o["landmark"]),
  };
}

router.post("/invoices", authenticate, async (req: AuthRequest, res) => {
  const { customerId, agentId, locationId, priceListId, couponCode, loyaltyPointsRedeem, paymentMode, channel, items, shippingAddress, billingAddress, logisticsDetails: extraLogistics } = req.body as {
    customerId?: string;
    agentId?: string;
    locationId?: string;
    priceListId?: string;
    couponCode?: string;
    loyaltyPointsRedeem?: number;
    paymentMode: string;
    channel?: string;
    items: Array<{ productId: string; variantId: string; qty: number }>;
    shippingAddress?: unknown;
    billingAddress?: unknown;
    logisticsDetails?: Record<string, unknown>;
  };
  const ship = sanitizeAddress(shippingAddress);
  const bill = sanitizeAddress(billingAddress) ?? ship;

  const settingsRows = await db.select().from(settingsTable).where(eq(settingsTable.key, "pricing")).limit(1);
  const pricingSettings = (settingsRows[0]?.value ?? {}) as any;
  const threshold = Number(pricingSettings.wholesaleQtyThreshold ?? 10);
  const chanel: PricingChannel = (channel ?? "RETAIL") as PricingChannel;

  let customerName: string | undefined;
  if (customerId) {
    const cRows = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    customerName = cRows[0]?.name;
  }

  const resolvedItems: Array<{
    productId: string;
    variantId: string;
    qty: number;
    amount: number;
    [k: string]: unknown;
  }> = [];
  for (const item of items) {
    const pRows = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    const product = pRows[0];
    if (!product) continue;
    const variants = (product.variants ?? []) as any[];
    const variant = variants.find((v: any) => v.variantId === item.variantId);
    if (!variant) continue;
    const priceResult = resolvePrice(variant, item.qty, chanel, threshold);
    resolvedItems.push({
      productId: item.productId,
      productName: product.name,
      variantId: item.variantId,
      variantSize: variant.size ?? "",
      qty: item.qty,
      resolvedPrice: priceResult.resolvedPrice,
      resolutionReason: priceResult.resolutionReason,
      bulkRateApplied: priceResult.bulkRateApplied,
      amount: priceResult.resolvedPrice * item.qty,
    });
  }

  const subtotal = resolvedItems.reduce((s, i) => s + i.amount, 0);
  const taxRate = Number(pricingSettings.taxRate ?? 0.18);
  const taxableAmount = subtotal;
  const cgst = taxableAmount * (taxRate / 2);
  const sgst = taxableAmount * (taxRate / 2);
  const total = taxableAmount + cgst + sgst;

  const fy = new Date().getFullYear();
  const financialYear = `${fy}-${fy + 1}`;
  const invoiceNo = await nextInvoiceNo();

  // Stock-ledger writes and the invoice insert run inside a single
  // transaction so a parent failure never leaves orphan ledger rows.
  const invoice = await db.transaction(async (tx) => {
    if (locationId) {
      for (const item of resolvedItems) {
        await appendLedger(
          {
            productId: item.productId,
            variantId: item.variantId,
            locationId,
            type: "OUT",
            qty: -item.qty,
            refType: "INVOICE",
            createdBy: req.user?.id,
          },
          tx,
        );
      }
    }
    const [inv] = await tx.insert(invoicesTable).values({
      id: crypto.randomUUID(),
      invoiceNo,
      customerId,
      customerName,
      agentId,
      locationId,
      priceListId,
      items: resolvedItems as typeof invoicesTable.$inferInsert["items"],
      subtotal: subtotal.toFixed(2),
      discountAmount: "0",
      couponCode,
      couponDiscount: "0",
      loyaltyPointsRedeemed: loyaltyPointsRedeem ?? 0,
      loyaltyDiscount: "0",
      taxableAmount: taxableAmount.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: "0",
      total: total.toFixed(2),
      paymentMode: paymentMode as any,
      channel: (channel ?? "RETAIL") as any,
      financialYear,
      status: paymentMode === "CREDIT" ? "credit" : "paid",
      logisticsDetails: (ship || bill || extraLogistics)
        ? {
            ...(extraLogistics ?? {}),
            ...(ship ? { shippingAddress: ship, address: ship } : {}),
            ...(bill ? { billingAddress: bill } : {}),
            ...(ship && bill ? { sameAsShipping: JSON.stringify(ship) === JSON.stringify(bill) } : {}),
          }
        : null,
      createdBy: req.user?.id,
    }).returning();
    return inv;
  });

  // Update outstanding balance if credit
  if (paymentMode === "CREDIT" && customerId) {
    const cRows = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (cRows[0]) {
      const newBalance = Number(cRows[0].outstandingBalance) + total;
      await db.update(customersTable).set({ outstandingBalance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(customersTable.id, customerId));
      await db.insert(creditLedgerTable).values({
        id: crypto.randomUUID(),
        customerId,
        type: "DEBIT",
        amount: total.toFixed(2),
        runningBalance: newBalance.toFixed(2),
        reference: invoiceNo,
        refType: "INVOICE",
        refId: invoice!.id,
      });
    }
  }

  // Earn loyalty points
  if (customerId) {
    const loyaltyRate = Number(pricingSettings.loyaltyEarnRate ?? 1);
    const points = Math.floor(total * loyaltyRate / 100);
    if (points > 0) {
      await db.update(customersTable).set({ loyaltyPoints: sql`${customersTable.loyaltyPoints} + ${points}`, updatedAt: new Date() }).where(eq(customersTable.id, customerId));
      await db.insert(loyaltyLedgerTable).values({
        id: crypto.randomUUID(),
        customerId,
        type: "EARN",
        points: points.toString(),
        referenceId: invoice!.id,
        notes: `Earned on invoice ${invoiceNo}`,
      });
    }
  }

  res.status(201).json(invoice);
});

router.get("/invoices/gst-report", authenticate, async (req, res) => {
  const { month, year } = req.query as Record<string, string>;
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endDate = new Date(parseInt(year), parseInt(month), 0);
  const rows = await db.select().from(invoicesTable).where(and(gte(invoicesTable.createdAt, startDate), lte(invoicesTable.createdAt, endDate)));
  const b2b = rows.filter((r) => r.customerGstin);
  const b2c = rows.filter((r) => !r.customerGstin);
  const totalTax = rows.reduce((s, r) => s + Number(r.cgst) + Number(r.sgst) + Number(r.igst), 0);
  res.json({ success: true, data: { b2b, b2c, summary: { totalTax, invoiceCount: rows.length } } });
});

router.get("/invoices/:id", authenticate, async (req, res) => {
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params["id"] as string)).limit(1);
  if (!rows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Invoice not found" } }); return; }
  res.json(rows[0]);
});

router.post("/invoices/:id/share", authenticate, async (_req, res) => {
  res.json({ success: true, message: "Invoice shared (notification queued)" });
});

export default router;
