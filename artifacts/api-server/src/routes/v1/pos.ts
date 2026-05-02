import { Router } from "express";
import { db, invoicesTable, productsTable, stockLevelsTable, heldBillsTable, posShiftsTable, settingsTable, customersTable, loyaltyLedgerTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { nextInvoiceNo } from "../../lib/counter.js";
import { resolvePrice } from "../../lib/pricing.js";
import { appendLedger } from "../../lib/stockService.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const router = Router();

router.get("/pos/products", authenticate, async (req, res) => {
  const { locationId } = req.query as Record<string, string>;
  const products = await db.select().from(productsTable).where(eq(productsTable.status, "Active")).limit(500);

  const enriched = await Promise.all(
    products.map(async (product) => {
      const variants = (product.variants ?? []) as any[];
      const enrichedVariants = await Promise.all(
        variants.map(async (v: any) => {
          let stock = 0;
          if (locationId) {
            const stockRows = await db.select().from(stockLevelsTable)
              .where(and(eq(stockLevelsTable.productId, product.id), eq(stockLevelsTable.variantId, v.variantId), eq(stockLevelsTable.locationId, locationId))).limit(1);
            stock = stockRows[0]?.currentQty ?? 0;
          }
          return {
            variantId: v.variantId,
            size: v.size,
            price: v.prices?.retailEst ?? 0,
            stock,
          };
        })
      );
      return { id: product.id, code: product.code, name: product.name, category: product.category, imageUrl: product.imageUrl, variants: enrichedVariants };
    })
  );

  res.json({ success: true, data: enriched });
});

router.post("/pos/sale", authenticate, async (req: AuthRequest, res) => {
  const { customerId, locationId, paymentMode, items, couponCode, loyaltyPointsRedeem } = req.body as {
    customerId?: string;
    locationId: string;
    paymentMode: string;
    items: Array<{ productId: string; variantId: string; qty: number }>;
    couponCode?: string;
    loyaltyPointsRedeem?: number;
  };

  const settingsRows = await db.select().from(settingsTable).where(eq(settingsTable.key, "pricing")).limit(1);
  const pricingSettings = (settingsRows[0]?.value ?? {}) as any;
  const threshold = Number(pricingSettings.wholesaleQtyThreshold ?? 10);
  const taxRate = Number(pricingSettings.taxRate ?? 0.18);

  const resolvedItems = [];
  for (const item of items) {
    const pRows = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    const product = pRows[0];
    if (!product) continue;
    const variants = (product.variants ?? []) as any[];
    const variant = variants.find((v: any) => v.variantId === item.variantId);
    if (!variant) continue;
    const priceResult = resolvePrice(variant, item.qty, "POS", threshold);
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
  const cgst = subtotal * (taxRate / 2);
  const sgst = subtotal * (taxRate / 2);
  const total = subtotal + cgst + sgst;

  const fy = new Date().getFullYear();
  const invoiceNo = await nextInvoiceNo();

  for (const item of resolvedItems) {
    await appendLedger({
      productId: item.productId,
      variantId: item.variantId,
      locationId,
      type: "OUT",
      qty: -item.qty,
      refType: "POS",
      createdBy: req.user?.id,
    });
  }

  const [invoice] = await db.insert(invoicesTable).values({
    id: crypto.randomUUID(),
    invoiceNo,
    customerId,
    items: resolvedItems,
    subtotal: subtotal.toFixed(2),
    discountAmount: "0",
    couponCode,
    couponDiscount: "0",
    taxableAmount: subtotal.toFixed(2),
    cgst: cgst.toFixed(2),
    sgst: sgst.toFixed(2),
    igst: "0",
    total: total.toFixed(2),
    paymentMode: paymentMode as any,
    channel: "POS",
    financialYear: `${fy}-${fy + 1}`,
    status: "paid",
    locationId,
    createdBy: req.user?.id,
  }).returning();

  // Earn loyalty points
  let loyaltyEarned = 0;
  if (customerId) {
    const loyaltyRate = Number(pricingSettings.loyaltyEarnRate ?? 1);
    loyaltyEarned = Math.floor(total * loyaltyRate / 100);
    if (loyaltyEarned > 0) {
      await db.update(customersTable).set({ loyaltyPoints: sql`${customersTable.loyaltyPoints} + ${loyaltyEarned}`, updatedAt: new Date() }).where(eq(customersTable.id, customerId));
      await db.insert(loyaltyLedgerTable).values({ id: crypto.randomUUID(), customerId, type: "EARN", points: loyaltyEarned.toString(), referenceId: invoice!.id, notes: `Earned on POS ${invoiceNo}` });
    }
  }

  res.json({ success: true, data: { invoice, loyaltyEarned } });
});

router.post("/pos/return", authenticate, async (req: AuthRequest, res) => {
  const { invoiceId, items, reason } = req.body as { invoiceId: string; items: Array<{ productId: string; variantId: string; qty: number }>; reason: string };
  const invRows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!invRows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Invoice not found" } }); return; }
  const inv = invRows[0];

  for (const item of items) {
    await appendLedger({
      productId: item.productId,
      variantId: item.variantId,
      locationId: inv.locationId ?? "",
      type: "IN",
      qty: item.qty,
      refType: "RETURN",
      refId: invoiceId,
      notes: reason,
      createdBy: req.user?.id,
    });
  }

  const returnId = crypto.randomUUID();
  res.json({ success: true, data: { returnId, creditAmount: 0 } });
});

router.post("/pos/hold", authenticate, async (req: AuthRequest, res) => {
  const { locationId, customerId, items, label, coupon } = req.body as {
    locationId: string;
    customerId?: string;
    items: unknown[];
    label?: string;
    coupon?: unknown;
  };
  // Wrap items + coupon together so the resume flow can rehydrate the cart fully.
  // Stays backward-compatible because the GET below also accepts raw arrays.
  const payload = coupon ? { lines: items, coupon } : items;
  await db.insert(heldBillsTable).values({ id: crypto.randomUUID(), locationId, customerId, label, items: payload as any, createdBy: req.user?.id });
  res.json({ success: true, message: "Bill held" });
});

router.get("/pos/held", authenticate, async (req, res) => {
  const { locationId } = req.query as Record<string, string>;
  const conditions = locationId ? [eq(heldBillsTable.locationId, locationId)] : [];
  const rows = await db.select().from(heldBillsTable).where(conditions.length > 0 ? and(...conditions) : undefined).limit(50);
  res.json({
    success: true,
    data: rows.map((r) => {
      const stored = r.items as unknown;
      const lines = Array.isArray(stored) ? stored : ((stored as { lines?: unknown[] })?.lines ?? []);
      const coupon = Array.isArray(stored) ? null : ((stored as { coupon?: unknown })?.coupon ?? null);
      return {
        id: r.id,
        holdId: r.id,
        label: r.label,
        items: lines,
        customerId: r.customerId,
        coupon,
        itemCount: Array.isArray(lines) ? lines.length : 0,
        createdAt: r.createdAt?.toISOString(),
      };
    }),
  });
});

router.post("/pos/shift-close", authenticate, async (req, res) => {
  res.json({ success: true, data: { totalSales: 0, cashSales: 0, upiSales: 0, cardSales: 0, creditSales: 0, openingCash: 0, closingCash: req.body.closingCash, overShort: 0 } });
});

export default router;
