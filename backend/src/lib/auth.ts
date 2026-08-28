import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser, UserRole } from "./authTypes.js";
import { UserModel } from "../models/user.js";

const TOKEN_DAYS = 7;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  return "food-app-dev-jwt-change-me";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret(), {
    expiresIn: `${TOKEN_DAYS}d`,
  });
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload & AuthUser;
    if (!payload.id || !payload.username || (payload.role !== "admin" && payload.role !== "staff")) {
      return null;
    }
    return { id: payload.id, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export function readRequestToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7).trim() || null;
  }
  const query = req.query.token;
  if (typeof query === "string" && query.trim()) return query.trim();
  return null;
}

export function getRequestAuth(req: Request): AuthUser | null {
  const token = readRequestToken(req);
  if (!token) return null;
  return verifyAuthToken(token);
}

export function requireAuth(roles?: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = getRequestAuth(req);
    if (!user) {
      res.status(401).json({ error: "ກະລຸນາເຂົ້າສູ່ລະບົບ." });
      return;
    }
    if (roles && !roles.includes(user.role)) {
      res.status(403).json({ error: "ທ່ານບໍ່ມີສິດເຂົ້າໜ້ານີ້." });
      return;
    }
    req.auth = user;
    next();
  };
}

export const requireAdmin = requireAuth(["admin"]);
export const requireStaffOrAdmin = requireAuth(["admin", "staff"]);

export async function ensureDefaultUsers(): Promise<void> {
  const now = new Date().toISOString();
  const defaults: { username: string; password: string; role: UserRole; name: string }[] = [
    { username: "admin", password: "123456", role: "admin", name: "ເຈົ້າຂອງຮ້ານ" },
    { username: "staff", password: "123456", role: "staff", name: "ພະນັກງານ" },
  ];

  for (const row of defaults) {
    try {
      const exists = await UserModel.findOne({ username: row.username }).lean();
      if (exists) {
        if (!exists.name) {
          await UserModel.updateOne({ id: exists.id }, { $set: { name: row.name } });
        }
        continue;
      }
      await UserModel.create({
        id: randomUUID(),
        username: row.username,
        name: row.name,
        passwordHash: await hashPassword(row.password),
        role: row.role,
        createdAt: now,
      });
      console.log(`Seeded ${row.role} user: ${row.username}`);
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? (err as { code?: number }).code : 0;
      if (code !== 11000) throw err;
    }
  }
}
