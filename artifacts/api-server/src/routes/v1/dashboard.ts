import { Router } from "express";
import { db, invoicesTable, stockLevelsTable, productsTable, customersTable, agentsTable, transfersTable } from "@workspace/db";
import { authenticate } from "../../middleware/authenticate.js";
import { eq, sql, gte, lte, and, desc, lt } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", authenticate, async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todaySalesRows, monthSalesRows, lowStockRows, activeTransfers, outstandingRows] = await Promise.all([
    db.select({ total: sql<number>`sum(cast(${invoicesTable.total} as numeric))`, count: sql<number>`count(*)` })
      .from(invoicesTable)
      .where(and(gte(invoicesTable.createdAt, today), eq(invoicesTable.status, "paid"))),
    db.select({ total: sql<number>`sum(cast(${invoicesTable.total} as numeric))` })
      .from(invoicesTable)
      .where(gte(invoicesTable.createdAt, new Date(today.getFullYear(), today.getMonth(), 1))),
    db.select({ count: sql<number>`count(*)` })
      .from(stockLevelsTable)
      .where(lt(stockLevelsTable.currentQty, 10)),
    db.select({ count: sql<number>`count(*)` })
      .from(transfersTable)
      .where(eq(transfersTable.status, "in_transit")),
    db.select({ total: sql<number>`sum(cast(${customersTable.outstandingBalance} as numeric))` })
      .from(customersTable),
  ]);

  const todaySales = Number(todaySalesRows[0]?.total ?? 0);
  const todayInvoices = Number(todaySalesRows[0]?.count ?? 0);
  const monthSales = Number(monthSalesRows[0]?.total ?? 0);
  const outstandingTotal = Number(outstandingRows[0]?.total ?? 0);
  const lowStockCount = Number(lowStockRows[0]?.count ?? 0);
  const activeTransfersCount = Number(activeTransfers[0]?.count ?? 0);

  res.json({
    success: true,
    data: {
      todaySales,
      todayInvoices,
      outstandingTotal,
      lowStockCount,
      activeTransfers: activeTransfersCount,
      monthSales,
      monthGrowth: 0,
    },
  });
});

router.get("/dashboard/sales-by-channel", authenticate, async (req, res) => {
  const rows = await db
    .select({
      channel: invoicesTable.channel,
      revenue: sql<number>`sum(cast(${invoicesTable.total} as numeric))`,
      count: sql<number>`count(*)`,
    })
    .from(invoicesTable)
    .groupBy(invoicesTable.channel);

  res.json({
    success: true,
    data: rows.map((r) => ({ channel: r.channel, revenue: Number(r.revenue), count: Number(r.count) })),
  });
});

router.get("/dashboard/top-products", authenticate, async (req, res) => {
  const limit = Number(req.query["limit"] ?? 5);
  const invoices = await db.select({ items: invoicesTable.items }).from(invoicesTable).limit(200);

  const map = new Map<string, { productName: string; totalQty: number; totalRevenue: number }>();
  for (const inv of invoices) {
    const items = (inv.items ?? []) as Array<{ productId: string; productName: string; qty: number; amount: number }>;
    for (const item of items) {
      const existing = map.get(item.productId) ?? { productName: item.productName, totalQty: 0, totalRevenue: 0 };
      existing.totalQty += item.qty;
      existing.totalRevenue += item.amount;
      map.set(item.productId, existing);
    }
  }

  const sorted = [...map.entries()]
    .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)
    .slice(0, limit)
    .map(([productId, v]) => ({ productId, ...v }));

  res.json({ success: true, data: sorted });
});

router.get("/dashboard/agent-performance", authenticate, async (_req, res) => {
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.status, "active")).limit(10);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const results = await Promise.all(
    agents.map(async (agent) => {
      const rows = await db
        .select({ total: sql<number>`sum(cast(${invoicesTable.total} as numeric))` })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.agentId, agent.id), gte(invoicesTable.createdAt, monthStart)));
      const sales = Number(rows[0]?.total ?? 0);
      const target = Number(agent.monthlyTarget ?? 0);
      return {
        agentId: agent.id,
        agentName: agent.name,
        sales,
        target,
        achievement: target > 0 ? Math.round((sales / target) * 100) : 0,
      };
    })
  );

  res.json({ success: true, data: results });
});

export default router;
