import { Router } from "express";
import { db, notificationLogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/notify/log", authenticate, async (req, res) => {
  const { eventType, status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, parseInt(limit));
  const offset = (pg - 1) * lim;
  const conditions = [];
  if (eventType) conditions.push(eq(notificationLogsTable.eventType, eventType));
  if (status) conditions.push(eq(notificationLogsTable.status, status as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(notificationLogsTable).where(where).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(notificationLogsTable).where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ success: true, data: rows, meta: { page: pg, limit: lim, total, pages: Math.ceil(total / lim) } });
});

export default router;
