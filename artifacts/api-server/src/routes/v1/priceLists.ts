import { Router } from "express";
import { db, priceListsTable } from "@workspace/db";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.get("/price-lists", authenticate, async (_req, res) => {
  const rows = await db.select().from(priceListsTable);
  res.json({ success: true, data: rows });
});

router.post("/price-lists", authenticate, async (req, res) => {
  const [pl] = await db.insert(priceListsTable).values({ ...req.body, id: crypto.randomUUID() }).returning();
  res.status(201).json({ success: true, data: pl });
});

export default router;
