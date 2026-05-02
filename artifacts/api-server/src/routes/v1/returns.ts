import { Router } from "express";
import { db, returnsTable, damageLedgerTable } from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";
import { appendLedger } from "../../lib/stockService.js";
import type { AuthRequest } from "../../middleware/authenticate.js";

const router = Router();

router.get("/returns", authenticate, async (req, res) => {
  const { type, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, parseInt(limit));
  const offset = (pg - 1) * lim;
  const conditions = [];
  if (type) conditions.push(eq(returnsTable.type, type as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(returnsTable).where(where).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(returnsTable).where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ success: true, data: rows, meta: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) } });
});

router.post("/damage", authenticate, async (req: AuthRequest, res) => {
  const { locationId, productId, variantId, batchNo, qty, category, description } = req.body;
  await Promise.all([
    db.insert(damageLedgerTable).values({
      id: crypto.randomUUID(),
      locationId, productId, variantId, batchNo, qty, category, description,
      createdBy: req.user?.id,
    }),
    appendLedger({
      productId, variantId, locationId,
      type: "DAMAGE",
      qty: -qty,
      batchNo,
      refType: "DAMAGE",
      notes: `${category}: ${description ?? ""}`,
      createdBy: req.user?.id,
    }),
  ]);
  res.status(201).json({ success: true, message: "Damage logged" });
});

router.get("/damage", authenticate, async (req, res) => {
  const { locationId, category } = req.query as Record<string, string>;
  const conditions = [];
  if (locationId) conditions.push(eq(damageLedgerTable.locationId, locationId));
  if (category) conditions.push(eq(damageLedgerTable.category, category as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(damageLedgerTable).where(where).limit(100);
  res.json({ success: true, data: rows });
});

export default router;
