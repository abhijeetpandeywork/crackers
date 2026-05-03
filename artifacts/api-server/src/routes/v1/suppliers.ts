import { Router } from "express";
import { db, suppliersTable } from "@workspace/db";
import { eq, ilike, and, sql } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/suppliers", authenticate, async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, parseInt(limit));
  const offset = (pg - 1) * lim;
  const conditions = [];
  if (search) conditions.push(ilike(suppliersTable.name, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(suppliersTable).where(where).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(suppliersTable).where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ success: true, data: rows, meta: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) } });
});

router.post("/suppliers", authenticate, async (req, res) => {
  const [supplier] = await db.insert(suppliersTable).values({ ...req.body, id: crypto.randomUUID() }).returning();
  res.status(201).json(supplier);
});

router.get("/suppliers/:id", authenticate, async (req, res) => {
  const rows = await db.select().from(suppliersTable).where(eq(suppliersTable.id, req.params["id"] as string)).limit(1);
  if (!rows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Supplier not found" } }); return; }
  res.json(rows[0]);
});

router.put("/suppliers/:id", authenticate, async (req, res) => {
  const [supplier] = await db.update(suppliersTable).set(req.body).where(eq(suppliersTable.id, req.params["id"] as string)).returning();
  if (!supplier) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Supplier not found" } }); return; }
  res.json(supplier);
});

export default router;
