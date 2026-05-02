import { Router } from "express";
import { db, locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/locations", authenticate, async (req, res) => {
  const { type } = req.query as Record<string, string>;
  const conditions = [];
  if (type) conditions.push(eq(locationsTable.type, type as any));
  const rows = await db.select().from(locationsTable).where(conditions.length > 0 ? conditions[0] : undefined).limit(100);
  res.json({ success: true, data: rows });
});

router.post("/locations", authenticate, async (req, res) => {
  const [location] = await db.insert(locationsTable).values({ ...req.body, id: crypto.randomUUID() }).returning();
  res.status(201).json({ success: true, data: location });
});

export default router;
