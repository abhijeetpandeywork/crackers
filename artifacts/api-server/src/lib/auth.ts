import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "ratinam-secret";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(payload: { id: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
}
