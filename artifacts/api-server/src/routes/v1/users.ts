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
    maxDiscountPct: usersTable.maxDiscountPct,
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

// Shared updater used by both PUT (full replace-style) and PATCH (partial).
// The two HTTP methods are intentionally identical here: the schema is small
// enough that we don't try to enforce required-fields on PUT.
async function updateUser(id: string, body: Record<string, unknown>) {
  const { password, ...rest } = body;
  const updates: Partial<typeof usersTable.$inferInsert> = {
    ...(rest as Partial<typeof usersTable.$inferInsert>),
    updatedAt: new Date(),
  };
  if (typeof password === "string" && password.length > 0) {
    updates.passwordHash = await hashPassword(password);
  }
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
    id: usersTable.id,
    name: usersTable.name,
    username: usersTable.username,
    role: usersTable.role,
    email: usersTable.email,
    phone: usersTable.phone,
    locationIds: usersTable.locationIds,
    maxDiscountPct: usersTable.maxDiscountPct,
    isActive: usersTable.isActive,
  });
  return user;
}

router.put("/users/:id", authenticate, adminOnly, async (req, res) => {
  const user = await updateUser(req.params["id"] as string, req.body as Record<string, unknown>);
  if (!user) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }); return; }
  res.json({ success: true, data: user });
});

router.patch("/users/:id", authenticate, adminOnly, async (req, res) => {
  const user = await updateUser(req.params["id"] as string, req.body as Record<string, unknown>);
  if (!user) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }); return; }
  res.json({ success: true, data: user });
});

export default router;
