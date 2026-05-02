import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/settings/company", authenticate, async (_req, res) => {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "company")).limit(1);
  const defaults = { companyName: "Rathinam Crackers", gstin: "", address: "Sivakasi, Tamil Nadu", phone: "", email: "", defaultHSN: "36049000", invoiceStartNumber: 1, financialYear: "2025-2026", bankDetails: "" };
  res.json({ success: true, data: rows[0] ? (rows[0].value as any) : defaults });
});

router.put("/settings/company", authenticate, async (req, res) => {
  await db.insert(settingsTable).values({ key: "company", value: req.body }).onConflictDoUpdate({ target: settingsTable.key, set: { value: req.body, updatedAt: new Date() } });
  res.json({ success: true, data: req.body });
});

router.get("/settings/pricing", authenticate, async (_req, res) => {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "pricing")).limit(1);
  const defaults = { wholesaleQtyThreshold: 10, defaultPriceListId: null, loyaltyEarnRate: 1, loyaltyRedemptionRate: 1, taxRate: 0.18 };
  res.json({ success: true, data: rows[0] ? (rows[0].value as any) : defaults });
});

router.put("/settings/pricing", authenticate, async (req, res) => {
  await db.insert(settingsTable).values({ key: "pricing", value: req.body }).onConflictDoUpdate({ target: settingsTable.key, set: { value: req.body, updatedAt: new Date() } });
  res.json({ success: true, data: req.body });
});

export default router;
