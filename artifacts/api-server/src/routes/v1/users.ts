import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../../middleware/authenticate.js";
import { hashPassword } from "../../lib/auth.js";

const router = Router();

// Admin-only: only SUPER_ADMIN may read or modify the user directory.
const adminOnly = requireRole("SUPER_ADMIN");

router.get("/users", authenticate, adminOnly, async (_req, res) => {
  const rows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    email: usersTable.email,
    phone: usersTable.phone,
    locationIds: usersTable.locationIds,
    maxDiscountPct: usersTable.maxDiscountPct,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).limit(100);
  res.json({ success: true, data: rows, meta: { page: 1, limit: 100, total: rows.length, pages: 1 } });
});

router.post("/users", authenticate, adminOnly, async (req, res) => {
  const { password, pin, ...rest } = req.body;
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ ...rest, id: crypto.randomUUID(), passwordHash, pin }).returning({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    email: usersTable.email,
    phone: usersTable.phone,
    locationIds: usersTable.locationIds,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  });
  res.status(201).json({ success: true, data: user });
});

router.get("/users/:id", authenticate, adminOnly, async (req, res) => {
  const rows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    email: usersTable.email,
    phone: usersTable.phone,
    locationIds: usersTable.locationIds,
    maxDiscountPct: usersTable.maxDiscountPct,
    isActive: usersTable.isActive,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, req.params["id"] as string)).limit(1);
  if (!rows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }); return; }
  res.json({ success: true, data: rows[0] });
});

router.put("/users/:id", authenticate, adminOnly, async (req, res) => {
  const { password, ...rest } = req.body;
  const updates: any = { ...rest, updatedAt: new Date() };
  if (password) updates.passwordHash = await hashPassword(password);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params["id"] as string)).returning({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    isActive: usersTable.isActive,
  });
  if (!user) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }); return; }
  res.json({ success: true, data: user });
});

export default router;
