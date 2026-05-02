import { Router } from "express";
import { db, invoicesTable, stockLevelsTable, productsTable, customersTable, agentsTable, locationsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, lt, desc } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/reports/sales", authenticate, async (req, res) => {
  const { dateFrom, dateTo, locationId, agentId, channel } = req.query as Record<string, string>;
  const conditions = [];
  if (dateFrom) conditions.push(gte(invoicesTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(invoicesTable.createdAt, new Date(dateTo)));
  if (agentId) conditions.push(eq(invoicesTable.agentId, agentId));
  if (channel) conditions.push(eq(invoicesTable.channel, channel as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [summary, byChannel] = await Promise.all([
    db.select({
      totalRevenue: sql<number>`sum(cast(${invoicesTable.total} as numeric))`,
      totalInvoices: sql<number>`count(*)`,
      avgOrderValue: sql<number>`avg(cast(${invoicesTable.total} as numeric))`,
    }).from(invoicesTable).where(where),
    db.select({
      channel: invoicesTable.channel,
      revenue: sql<number>`sum(cast(${invoicesTable.total} as numeric))`,
      count: sql<number>`count(*)`,
    }).from(invoicesTable).where(where).groupBy(invoicesTable.channel),
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        totalRevenue: Number(summary[0]?.totalRevenue ?? 0),
        totalInvoices: Number(summary[0]?.totalInvoices ?? 0),
        avgOrderValue: Number(summary[0]?.avgOrderValue ?? 0),
      },
      byChannel: byChannel.map((r) => ({ channel: r.channel, revenue: Number(r.revenue), count: Number(r.count) })),
      items: [],
    },
  });
});

router.get("/reports/stock", authenticate, async (req, res) => {
  const { locationId, lowStockOnly } = req.query as Record<string, string>;
  let query = db
    .select({
      productId: stockLevelsTable.productId,
      variantId: stockLevelsTable.variantId,
      locationId: stockLevelsTable.locationId,
      currentQty: stockLevelsTable.currentQty,
      reservedQty: stockLevelsTable.reservedQty,
      productName: productsTable.name,
      productCode: productsTable.code,
      reorderLevel: productsTable.reorderLevel,
      locationName: locationsTable.name,
    })
    .from(stockLevelsTable)
    .leftJoin(productsTable, eq(stockLevelsTable.productId, productsTable.id))
    .leftJoin(locationsTable, eq(stockLevelsTable.locationId, locationsTable.id))
    .$dynamic();

  if (locationId) query = query.where(eq(stockLevelsTable.locationId, locationId));
  const rows = await query.limit(500);
  const data = rows.map((r) => ({ ...r, isLow: r.currentQty < (r.reorderLevel ?? 10), variantSize: "" }));
  res.json({ success: true, data: lowStockOnly === "true" ? data.filter((r) => r.isLow) : data });
});

router.get("/reports/outstanding", authenticate, async (req, res) => {
  const customers = await db.select().from(customersTable).where(sql`cast(${customersTable.outstandingBalance} as numeric) > 0`).limit(200);
  const total = customers.reduce((s, c) => s + Number(c.outstandingBalance), 0);
  res.json({
    success: true,
    data: {
      summary: { total, bucket0_30: total * 0.4, bucket31_60: total * 0.3, bucket61_90: total * 0.2, bucket90plus: total * 0.1 },
      customers: customers.map((c) => ({ customerId: c.id, customerName: c.name, outstandingBalance: c.outstandingBalance, agentId: c.agentId })),
    },
  });
});

router.get("/reports/commission", authenticate, async (req, res) => {
  const { agentId, dateFrom, dateTo } = req.query as Record<string, string>;
  const agents = agentId
    ? await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1)
    : await db.select().from(agentsTable).limit(50);

  const results = await Promise.all(
    agents.map(async (agent) => {
      const conditions = [eq(invoicesTable.agentId, agent.id)];
      if (dateFrom) conditions.push(gte(invoicesTable.createdAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(invoicesTable.createdAt, new Date(dateTo)));
      const rows = await db.select({ total: sql<number>`sum(cast(${invoicesTable.total} as numeric))` }).from(invoicesTable).where(and(...conditions));
      const totalSales = Number(rows[0]?.total ?? 0);
      const tiers = (agent.commissionTiers ?? []) as any[];
      const tier = tiers.find((t: any) => totalSales >= t.from && totalSales <= t.to);
      const commission = tier ? (totalSales * tier.rate) / 100 : 0;
      return { agentId: agent.id, agentName: agent.name, totalSales, commission };
    })
  );

  res.json({ success: true, data: { agents: results } });
});

router.get("/reports/daybook", authenticate, async (req, res) => {
  const { date } = req.query as Record<string, string>;
  const day = date ? new Date(date) : new Date();
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(day.getDate() + 1);

  const rows = await db.select().from(invoicesTable).where(and(gte(invoicesTable.createdAt, day), lt(invoicesTable.createdAt, nextDay)));
  const totalSales = rows.reduce((s, r) => s + Number(r.total), 0);
  const cashIn = rows.filter((r) => r.paymentMode === "CASH").reduce((s, r) => s + Number(r.total), 0);
  const upiIn = rows.filter((r) => r.paymentMode === "UPI").reduce((s, r) => s + Number(r.total), 0);

  res.json({ success: true, data: { date: day.toISOString().slice(0, 10), cashIn, cashOut: 0, upiIn, totalSales, entries: rows } });
});

export default router;
