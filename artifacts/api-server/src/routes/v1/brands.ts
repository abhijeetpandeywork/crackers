import { Router } from "express";
import { db, brandsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../../middleware/authenticate.js";
import { auditWrite } from "../../lib/audit.js";

const router = Router();

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const isPrivileged = (role?: string) =>
  role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER";

router.get("/brands", authenticate, async (_req, res) => {
  const rows = await db
    .select()
    .from(brandsTable)
    .orderBy(asc(brandsTable.sortOrder), asc(brandsTable.name));
  res.json({ success: true, data: rows });
});

router.get("/brands/public", async (_req, res) => {
  const rows = await db
    .select()
    .from(brandsTable)
    .where(eq(brandsTable.isActive, true))
    .orderBy(asc(brandsTable.sortOrder), asc(brandsTable.name));
  res.json({ success: true, data: rows });
});

router.post("/brands", authenticate, async (req: AuthRequest, res) => {
  if (!isPrivileged(req.user?.role)) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin or manager role required" } });
    return;
  }
  const { name, logoUrl, description, sortOrder, isActive } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ success: false, error: { code: "VALIDATION", message: "Brand name is required" } });
    return;
  }
  const slug = slugify(name);
  try {
    const [brand] = await db
      .insert(brandsTable)
      .values({
        name: name.trim(),
        slug,
        logoUrl: logoUrl || null,
        description: description || null,
        sortOrder: Number.isFinite(sortOrder) ? Number(sortOrder) : 0,
        isActive: isActive !== false,
      })
      .returning();
    await auditWrite(req, { action: "CREATE", entityType: "brand", entityId: brand?.id, after: brand });
    res.status(201).json({ success: true, data: brand });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ success: false, error: { code: "DUPLICATE", message: "Brand with that name already exists" } });
      return;
    }
    throw err;
  }
});

router.patch("/brands/:id", authenticate, async (req: AuthRequest, res) => {
  if (!isPrivileged(req.user?.role)) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin or manager role required" } });
    return;
  }
  const id = req.params["id"] as string;
  const { name, logoUrl, description, sortOrder, isActive } = req.body ?? {};
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim()) {
    patch["name"] = name.trim();
    patch["slug"] = slugify(name);
  }
  if (logoUrl !== undefined) patch["logoUrl"] = logoUrl || null;
  if (description !== undefined) patch["description"] = description || null;
  if (Number.isFinite(sortOrder)) patch["sortOrder"] = Number(sortOrder);
  if (typeof isActive === "boolean") patch["isActive"] = isActive;

  try {
    const before = (await db.select().from(brandsTable).where(eq(brandsTable.id, id)).limit(1))[0] ?? null;
    const [brand] = await db.update(brandsTable).set(patch).where(eq(brandsTable.id, id)).returning();
    if (!brand) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Brand not found" } });
      return;
    }
    await auditWrite(req, { action: "UPDATE", entityType: "brand", entityId: id, before, after: brand });
    res.json({ success: true, data: brand });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ success: false, error: { code: "DUPLICATE", message: "Brand with that name already exists" } });
      return;
    }
    throw err;
  }
});

router.delete("/brands/:id", authenticate, async (req: AuthRequest, res) => {
  if (req.user?.role !== "SUPER_ADMIN" && req.user?.role !== "ADMIN") {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Admin role required" } });
    return;
  }
  const id = req.params["id"] as string;
  const [brand] = await db.delete(brandsTable).where(eq(brandsTable.id, id)).returning();
  if (!brand) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Brand not found" } });
    return;
  }
  await auditWrite(req, { action: "DELETE", entityType: "brand", entityId: id, before: brand });
  res.json({ success: true, data: { id } });
});

export default router;
