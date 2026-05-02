import { Router } from "express";
import { db, customersTable, creditLedgerTable, loyaltyLedgerTable } from "@workspace/db";
import { eq, ilike, and, sql, desc } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/customers", authenticate, async (req, res) => {
  const { search, customerType, agentId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, parseInt(limit));
  const offset = (pg - 1) * lim;

  const conditions = [];
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  if (customerType) conditions.push(eq(customersTable.customerType, customerType as any));
  if (agentId) conditions.push(eq(customersTable.agentId, agentId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countRows] = await Promise.all([
    db.select().from(customersTable).where(where).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ success: true, data: rows, meta: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) } });
});

router.post("/customers", authenticate, async (req, res) => {
  const [customer] = await db.insert(customersTable).values({ ...req.body, id: crypto.randomUUID() }).returning();
  res.status(201).json({ success: true, data: customer });
});

router.get("/customers/:id", authenticate, async (req, res) => {
  const rows = await db.select().from(customersTable).where(eq(customersTable.id, req.params["id"]!)).limit(1);
  if (!rows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Customer not found" } }); return; }
  res.json({ success: true, data: rows[0] });
});

router.put("/customers/:id", authenticate, async (req, res) => {
  const [customer] = await db.update(customersTable).set({ ...req.body, updatedAt: new Date() }).where(eq(customersTable.id, req.params["id"]!)).returning();
  if (!customer) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Customer not found" } }); return; }
  res.json({ success: true, data: customer });
});

router.get("/customers/:id/statement", authenticate, async (req, res) => {
  const entries = await db
    .select()
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.customerId, req.params["id"]!))
    .orderBy(desc(creditLedgerTable.createdAt))
    .limit(100);
  const customerRows = await db.select().from(customersTable).where(eq(customersTable.id, req.params["id"]!)).limit(1);
  const balance = Number(customerRows[0]?.outstandingBalance ?? 0);
  res.json({ success: true, data: { entries, currentBalance: balance } });
});

router.get("/customers/:id/loyalty", authenticate, async (req, res) => {
  const entries = await db
    .select()
    .from(loyaltyLedgerTable)
    .where(eq(loyaltyLedgerTable.customerId, req.params["id"]!))
    .orderBy(desc(loyaltyLedgerTable.createdAt))
    .limit(100);
  const customerRows = await db.select().from(customersTable).where(eq(customersTable.id, req.params["id"]!)).limit(1);
  const totalPoints = customerRows[0]?.loyaltyPoints ?? 0;
  res.json({ success: true, data: { entries, totalPoints } });
});

router.post("/customers/:id/payment", authenticate, async (req, res) => {
  const { amount, date, reference, notes } = req.body as { amount: number; date: string; reference?: string; notes?: string };
  const cid = req.params["id"]!;
  const customerRows = await db.select().from(customersTable).where(eq(customersTable.id, cid)).limit(1);
  if (!customerRows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Customer not found" } }); return; }
  const newBalance = Number(customerRows[0].outstandingBalance) - amount;
  await Promise.all([
    db.update(customersTable).set({ outstandingBalance: newBalance.toFixed(2), updatedAt: new Date() }).where(eq(customersTable.id, cid)),
    db.insert(creditLedgerTable).values({
      id: crypto.randomUUID(),
      customerId: cid,
      type: "PAYMENT",
      amount: (-amount).toFixed(2),
      runningBalance: newBalance.toFixed(2),
      reference,
      notes,
      refType: "PAYMENT",
    }),
  ]);
  res.json({ success: true, message: "Payment recorded" });
});

export default router;
