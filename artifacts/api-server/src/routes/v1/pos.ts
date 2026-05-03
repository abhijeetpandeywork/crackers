import { Router } from "express";
import {
  db,
  invoicesTable,
  productsTable,
  stockLevelsTable,
  heldBillsTable,
  posShiftsTable,
  settingsTable,
  customersTable,
  loyaltyLedgerTable,
  type HeldBillItemsPayload,
} from "@workspace/db";
import { eq, and, sql, inArray, desc, isNull } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { nextInvoiceNo } from "../../lib/counter.js";
import { resolvePrice } from "../../lib/pricing.js";
import { appendLedger } from "../../lib/stockService.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const router = Router();

// -------- helpers --------

type Tender = { mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amount: number; reference?: string };

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

async function findOpenShift(userId: string, locationId?: string) {
  const conds = [eq(posShiftsTable.userId, userId), eq(posShiftsTable.status, "open")];
  if (locationId) conds.push(eq(posShiftsTable.locationId, locationId));
  const rows = await db
    .select()
    .from(posShiftsTable)
    .where(and(...conds))
    .orderBy(desc(posShiftsTable.openedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Compute live totals from invoices linked to a shift. Splits SPLIT-mode invoices by their stored tender breakdown. */
async function computeShiftTotals(shiftId: string) {
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.shiftId, shiftId));
  let totalSales = 0,
    cashSales = 0,
    upiSales = 0,
    cardSales = 0,
    creditSales = 0;
  for (const inv of rows) {
    const t = num(inv.total);
    totalSales += t;
    const logistics = (inv.logisticsDetails ?? null) as { tenders?: Tender[] } | null;
    const tenders = logistics?.tenders;
    if (Array.isArray(tenders) && tenders.length > 0) {
      for (const tn of tenders) {
        const a = num(tn.amount);
        if (tn.mode === "CASH") cashSales += a;
        else if (tn.mode === "UPI") upiSales += a;
        else if (tn.mode === "CARD") cardSales += a;
        else if (tn.mode === "CREDIT") creditSales += a;
      }
    } else {
      // legacy single-tender invoices
      switch (inv.paymentMode) {
        case "CASH":
          cashSales += t;
          break;
        case "UPI":
          upiSales += t;
          break;
        case "CARD":
          cardSales += t;
          break;
        case "CREDIT":
          creditSales += t;
          break;
        default:
          // SPLIT with no tender array — bucket as cash to avoid silent drop
          cashSales += t;
      }
    }
  }
  return { txnCount: rows.length, totalSales, cashSales, upiSales, cardSales, creditSales };
}

// -------- products --------

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
            const stockRows = await db
              .select()
              .from(stockLevelsTable)
              .where(
                and(
                  eq(stockLevelsTable.productId, product.id),
                  eq(stockLevelsTable.variantId, v.variantId),
                  eq(stockLevelsTable.locationId, locationId),
                ),
              )
              .limit(1);
            stock = stockRows[0]?.currentQty ?? 0;
          }
          return { variantId: v.variantId, size: v.size, price: v.prices?.retailEst ?? 0, stock };
        }),
      );
      return {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl,
        variants: enrichedVariants,
      };
    }),
  );

  res.json({ success: true, data: enriched });
});

// -------- shifts --------

router.post("/pos/shift-open", authenticate, async (req: AuthRequest, res) => {
  const { locationId, openingCash, notes } = req.body as {
    locationId: string;
    openingCash: number;
    notes?: string;
  };
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Login required" } });
    return;
  }
  if (!locationId || typeof openingCash !== "number" || Number.isNaN(openingCash) || openingCash < 0) {
    res
      .status(400)
      .json({ success: false, error: { code: "VALIDATION", message: "locationId and non-negative openingCash required" } });
    return;
  }
  const existing = await findOpenShift(req.user.id, locationId);
  if (existing) {
    const running = await computeShiftTotals(existing.id);
    res.json({
      success: true,
      data: {
        ...existing,
        openingCash: num(existing.openingCash),
        running: { ...running, expectedCash: num(existing.openingCash) + running.cashSales },
      },
    });
    return;
  }
  const [shift] = await db
    .insert(posShiftsTable)
    .values({
      locationId,
      userId: req.user.id,
      openingCash: openingCash.toFixed(2),
      status: "open",
      notes: notes ?? null,
    })
    .returning();
  res.json({
    success: true,
    data: {
      ...shift!,
      openingCash: num(shift!.openingCash),
      running: { txnCount: 0, totalSales: 0, cashSales: 0, upiSales: 0, cardSales: 0, creditSales: 0, expectedCash: openingCash },
    },
  });
});

router.get("/pos/shift-current", authenticate, async (req: AuthRequest, res) => {
  if (!req.user?.id) {
    res.json({ success: true, data: null });
    return;
  }
  const { locationId } = req.query as Record<string, string>;
  const shift = await findOpenShift(req.user.id, locationId);
  if (!shift) {
    res.json({ success: true, data: null });
    return;
  }
  const running = await computeShiftTotals(shift.id);
  res.json({
    success: true,
    data: {
      ...shift,
      openingCash: num(shift.openingCash),
      running: { ...running, expectedCash: num(shift.openingCash) + running.cashSales },
    },
  });
});

router.post("/pos/shift-close", authenticate, async (req: AuthRequest, res) => {
  const { shiftId, closingCash, notes } = req.body as {
    shiftId?: string;
    closingCash: number;
    notes?: string;
  };
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Login required" } });
    return;
  }

  // Resolve target shift: explicit id, else the user's currently open one.
  let shift = shiftId
    ? (await db.select().from(posShiftsTable).where(eq(posShiftsTable.id, shiftId)).limit(1))[0] ?? null
    : await findOpenShift(req.user.id);
  if (!shift) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "No open shift found" } });
    return;
  }
  // Cashiers may only close their own shift. Managers/admins can close any.
  const role = req.user.role ?? "";
  const isPrivileged = role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";
  if (shift.userId !== req.user.id && !isPrivileged) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Cannot close another cashier's shift" } });
    return;
  }
  if (shift.status === "closed") {
    res.status(409).json({ success: false, error: { code: "ALREADY_CLOSED", message: "Shift already closed" } });
    return;
  }

  const running = await computeShiftTotals(shift.id);
  const opening = num(shift.openingCash);
  const expectedCash = opening + running.cashSales;
  const counted = num(closingCash);
  const overShort = counted - expectedCash;

  const closedAt = new Date();
  await db
    .update(posShiftsTable)
    .set({
      status: "closed",
      closedAt,
      closingCash: counted.toFixed(2),
      totalSales: running.totalSales.toFixed(2),
      cashSales: running.cashSales.toFixed(2),
      upiSales: running.upiSales.toFixed(2),
      cardSales: running.cardSales.toFixed(2),
      creditSales: running.creditSales.toFixed(2),
      notes: notes ?? shift.notes,
    })
    .where(eq(posShiftsTable.id, shift.id));

  res.json({
    success: true,
    data: {
      shiftId: shift.id,
      openedAt: shift.openedAt?.toISOString(),
      closedAt: closedAt.toISOString(),
      txnCount: running.txnCount,
      totalSales: running.totalSales,
      cashSales: running.cashSales,
      upiSales: running.upiSales,
      cardSales: running.cardSales,
      creditSales: running.creditSales,
      openingCash: opening,
      expectedCash,
      closingCash: counted,
      overShort,
      notes: notes ?? shift.notes ?? "",
    },
  });
});

// -------- sale --------

router.post("/pos/sale", authenticate, async (req: AuthRequest, res) => {
  const {
    customerId,
    locationId,
    paymentMode,
    tenders: tendersInput,
    cashReceived,
    orderDiscount,
    discountReason,
    items,
    couponCode,
    shiftId: explicitShiftId,
  } = req.body as {
    customerId?: string;
    locationId: string;
    paymentMode?: string;
    tenders?: Tender[];
    cashReceived?: number;
    orderDiscount?: number;
    discountReason?: string;
    items: Array<{ productId: string; variantId: string; qty: number }>;
    couponCode?: string;
    shiftId?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: { code: "VALIDATION", message: "Cart is empty" } });
    return;
  }

  // Reject any non-positive or non-finite quantities. Without this a malicious
  // client could send qty=-1 to "refund" stock and reduce the bill.
  for (const it of items) {
    if (!it || typeof it.qty !== "number" || !Number.isFinite(it.qty) || it.qty <= 0) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION", message: "Each item must have a positive quantity" },
      });
      return;
    }
  }

  const settingsRows = await db.select().from(settingsTable).where(eq(settingsTable.key, "pricing")).limit(1);
  const pricingSettings = (settingsRows[0]?.value ?? {}) as any;
  const threshold = Number(pricingSettings.wholesaleQtyThreshold ?? 10);
  const taxRate = Number(pricingSettings.taxRate ?? 0.18);

  // Resolve lines with the same pricing engine the rest of the system uses.
  const resolvedItems: any[] = [];
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

  // Cap discount by user role. Without this a cashier could ring up a 99%
  // discount via the API and bypass the UI's manual-discount field.
  const role = (req.user?.role ?? "CASHIER").toUpperCase();
  const discountCapPct = (() => {
    if (role === "SUPER_ADMIN" || role === "ADMIN") return 100;
    if (role === "ERP_MANAGER" || role === "MANAGER") return Number(pricingSettings.maxManagerDiscountPct ?? 50);
    return Number(pricingSettings.maxCashierDiscountPct ?? 10);
  })();
  const maxAllowedDiscount = subtotal * (discountCapPct / 100);
  const requestedDiscount = Math.max(0, num(orderDiscount));
  if (requestedDiscount > maxAllowedDiscount + 0.01) {
    res.status(403).json({
      success: false,
      error: {
        code: "DISCOUNT_LIMIT",
        message: `Your role (${role}) can apply at most ${discountCapPct}% discount (₹${maxAllowedDiscount.toFixed(2)} on this bill)`,
      },
    });
    return;
  }
  const manualDiscount = Math.min(requestedDiscount, maxAllowedDiscount);
  const taxable = Math.max(0, subtotal - manualDiscount);
  const cgst = taxable * (taxRate / 2);
  const sgst = taxable * (taxRate / 2);
  const total = taxable + cgst + sgst;

  // Tender validation. Strict: known modes only, non-negative finite amounts.
  const ALLOWED_MODES = new Set(["CASH", "UPI", "CARD", "CREDIT"]);
  const rawTenders: Tender[] = Array.isArray(tendersInput) && tendersInput.length > 0
    ? tendersInput.map((t) => ({ mode: t.mode, amount: Number(t.amount), reference: t.reference }))
    : paymentMode && ALLOWED_MODES.has(paymentMode)
      ? [{ mode: paymentMode as Tender["mode"], amount: total }]
      : [{ mode: "CASH", amount: total }];

  for (const t of rawTenders) {
    if (!ALLOWED_MODES.has(t.mode)) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: `Invalid tender mode: ${t.mode}` } });
      return;
    }
    if (!Number.isFinite(t.amount) || t.amount < 0) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "Tender amount must be a non-negative number" } });
      return;
    }
  }

  const tenderSum = rawTenders.reduce((s, t) => s + t.amount, 0);
  // 1-paisa tolerance only.
  if (Math.abs(tenderSum - total) > 0.01) {
    res.status(400).json({
      success: false,
      error: {
        code: "TENDER_MISMATCH",
        message: `Tender total ₹${tenderSum.toFixed(2)} does not match bill total ₹${total.toFixed(2)}`,
      },
    });
    return;
  }

  const nonZero = rawTenders.filter((t) => t.amount > 0);
  const finalPaymentMode: "CASH" | "UPI" | "CARD" | "CREDIT" | "SPLIT" =
    nonZero.length > 1 ? "SPLIT" : (nonZero[0]?.mode ?? "CASH");

  // Resolve target shift with ownership + state checks. Reject forged or foreign shift ids.
  let shiftId: string | null = null;
  if (explicitShiftId) {
    const rows = await db.select().from(posShiftsTable).where(eq(posShiftsTable.id, explicitShiftId)).limit(1);
    const target = rows[0];
    if (!target) {
      res.status(404).json({ success: false, error: { code: "SHIFT_NOT_FOUND", message: "Shift not found" } });
      return;
    }
    if (target.userId !== req.user?.id) {
      res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Shift does not belong to this cashier" } });
      return;
    }
    if (target.locationId !== locationId) {
      res.status(400).json({ success: false, error: { code: "SHIFT_LOCATION_MISMATCH", message: "Shift location does not match sale location" } });
      return;
    }
    if (target.status !== "open") {
      res.status(409).json({ success: false, error: { code: "SHIFT_CLOSED", message: "Shift is already closed" } });
      return;
    }
    shiftId = target.id;
  } else if (req.user?.id) {
    const open = await findOpenShift(req.user.id, locationId);
    shiftId = open?.id ?? null;
  }

  const fy = new Date().getFullYear();
  const invoiceNo = await nextInvoiceNo();

  // Stock movements first so a failure rejects the sale before persisting the invoice.
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

  const status: "paid" | "credit" =
    finalPaymentMode === "CREDIT" || nonZero.some((t) => t.mode === "CREDIT") ? "credit" : "paid";

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      id: crypto.randomUUID(),
      invoiceNo,
      customerId,
      items: resolvedItems,
      subtotal: subtotal.toFixed(2),
      discountAmount: manualDiscount.toFixed(2),
      couponCode,
      couponDiscount: "0",
      taxableAmount: taxable.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: "0",
      total: total.toFixed(2),
      paymentMode: finalPaymentMode,
      channel: "POS",
      financialYear: `${fy}-${fy + 1}`,
      status,
      locationId,
      shiftId: shiftId ?? undefined,
      logisticsDetails: {
        tenders: nonZero,
        cashReceived: num(cashReceived),
        change: Math.max(0, num(cashReceived) - (nonZero.find((t) => t.mode === "CASH")?.amount ?? 0)),
        discountReason: discountReason ?? null,
      } as any,
      createdBy: req.user?.id,
    })
    .returning();

  // Loyalty earn (paid sales only).
  let loyaltyEarned = 0;
  if (customerId && status === "paid") {
    const loyaltyRate = Number(pricingSettings.loyaltyEarnRate ?? 1);
    loyaltyEarned = Math.floor((total * loyaltyRate) / 100);
    if (loyaltyEarned > 0) {
      await db
        .update(customersTable)
        .set({ loyaltyPoints: sql`${customersTable.loyaltyPoints} + ${loyaltyEarned}`, updatedAt: new Date() })
        .where(eq(customersTable.id, customerId));
      await db.insert(loyaltyLedgerTable).values({
        id: crypto.randomUUID(),
        customerId,
        type: "EARN",
        points: loyaltyEarned.toString(),
        referenceId: invoice!.id,
        notes: `Earned on POS ${invoiceNo}`,
      });
    }
  }

  res.json({ success: true, data: { invoice, loyaltyEarned } });
});

// -------- recent (for reprint) --------

router.get("/pos/recent", authenticate, async (req, res) => {
  const { locationId, limit } = req.query as Record<string, string>;
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));
  const conds = [eq(invoicesTable.channel, "POS" as any)];
  if (locationId) conds.push(eq(invoicesTable.locationId, locationId));
  const rows = await db
    .select()
    .from(invoicesTable)
    .where(and(...conds))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(lim);

  const customerIds = Array.from(new Set(rows.map((r) => r.customerId).filter((id): id is string => !!id)));
  const customerRows = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];
  const nameById = new Map(customerRows.map((c) => [c.id, c.name]));

  res.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      invoiceNo: r.invoiceNo,
      total: num(r.total),
      paymentMode: r.paymentMode,
      customerName: r.customerId ? nameById.get(r.customerId) ?? null : null,
      createdAt: r.createdAt?.toISOString(),
      itemCount: Array.isArray(r.items) ? (r.items as any[]).length : 0,
    })),
  });
});

// -------- return --------

router.post("/pos/return", authenticate, async (req: AuthRequest, res) => {
  const { invoiceId, items, reason } = req.body as {
    invoiceId: string;
    items: Array<{ productId: string; variantId: string; qty: number }>;
    reason: string;
  };
  const invRows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
  if (!invRows[0]) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Invoice not found" } });
    return;
  }
  const inv = invRows[0];

  // Compute credit amount from the original invoice line prices.
  const origItems = (inv.items ?? []) as any[];
  let creditAmount = 0;
  for (const item of items) {
    const orig = origItems.find((o) => o.productId === item.productId && o.variantId === item.variantId);
    const unit = orig ? num(orig.resolvedPrice ?? orig.unitPrice) : 0;
    creditAmount += unit * item.qty;
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
  res.json({ success: true, data: { returnId, creditAmount } });
});

// -------- hold / resume --------

router.post("/pos/hold", authenticate, async (req: AuthRequest, res) => {
  const { locationId, customerId, items, label, coupon } = req.body as {
    locationId: string;
    customerId?: string;
    items: unknown[];
    label?: string;
    coupon?: unknown;
  };
  const payload: HeldBillItemsPayload = coupon ? { lines: items, coupon } : items;
  await db.insert(heldBillsTable).values({
    id: crypto.randomUUID(),
    locationId,
    customerId,
    label,
    items: payload,
    createdBy: req.user?.id,
  });
  res.json({ success: true, message: "Bill held" });
});

router.get("/pos/held", authenticate, async (req, res) => {
  const { locationId } = req.query as Record<string, string>;
  const conditions = locationId ? [eq(heldBillsTable.locationId, locationId)] : [];
  const rows = await db
    .select()
    .from(heldBillsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(50);

  const customerIds = Array.from(new Set(rows.map((r) => r.customerId).filter((id): id is string => !!id)));
  const customerRows = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];
  const customerById = new Map(customerRows.map((c) => [c.id, c]));

  res.json({
    success: true,
    data: rows.map((r) => {
      const stored = r.items;
      const lines: unknown[] = Array.isArray(stored) ? stored : (stored.lines ?? []);
      const coupon: unknown = Array.isArray(stored) ? null : (stored.coupon ?? null);
      return {
        id: r.id,
        holdId: r.id,
        label: r.label,
        items: lines,
        customerId: r.customerId,
        customer: r.customerId ? customerById.get(r.customerId) ?? null : null,
        coupon,
        itemCount: lines.length,
        createdAt: r.createdAt?.toISOString(),
      };
    }),
  });
});

// suppress lint for unused imports kept for future expansion
void isNull;

export default router;
