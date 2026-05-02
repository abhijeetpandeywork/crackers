import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyToken } from "../../lib/auth.js";
import type { AuthRequest } from "../../middleware/authenticate.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "username and password required" } });
    return;
  }
  const rows = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const user = rows[0];
  if (!user || !user.isActive) {
    res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
    return;
  }
  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = signRefreshToken({ id: user.id });
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));
  res.json({
    success: true,
    data: {
      accessToken,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, locationIds: user.locationIds, maxDiscountPct: user.maxDiscountPct },
    },
  });
});

router.post("/auth/pin-login", async (req, res) => {
  const { username, pin } = req.body as { username: string; pin: string; locationId: string };
  if (!username || !pin) {
    res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "username and pin required" } });
    return;
  }
  const rows = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const user = rows[0];
  if (!user || !user.isActive || user.pin !== pin) {
    res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid PIN" } });
    return;
  }
  const accessToken = signAccessToken({ id: user.id, role: user.role });
  res.json({
    success: true,
    data: {
      accessToken,
      user: { id: user.id, name: user.name, username: user.username, role: user.role, locationIds: user.locationIds },
    },
  });
});

router.post("/auth/refresh", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing token" } });
    return;
  }
  try {
    const payload = verifyToken(auth.slice(7));
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, payload.id)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not found" } });
      return;
    }
    const accessToken = signAccessToken({ id: user.id, role: user.role });
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, error: { code: "INVALID_TOKEN", message: "Invalid token" } });
  }
});

router.post("/auth/logout", authenticate, async (req: AuthRequest, res) => {
  if (req.user) {
    await db.update(usersTable).set({ refreshToken: null }).where(eq(usersTable.id, req.user.id));
  }
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", authenticate, async (req: AuthRequest, res) => {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }
  res.json({
    success: true,
    data: { id: user.id, name: user.name, username: user.username, role: user.role, locationIds: user.locationIds, maxDiscountPct: user.maxDiscountPct },
  });
});

export default router;
