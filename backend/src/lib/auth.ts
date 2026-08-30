import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { AuthUser, UserRole } from "./authTypes.js";
import { UserModel } from "../models/user.js";
import { DEFAULT_PASSWORD } from "./password.js";

const TOKEN_DAYS = 7;
const BCRYPT_ROUNDS = 12;
const tokenVersionByUser = new Map<string, number>();

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  return "food-app-dev-jwt-change-me";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function rememberTokenVersion(userId: string, version: number): void {
  tokenVersionByUser.set(userId, version);
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    },
    jwtSecret(),
    { expiresIn: `${TOKEN_DAYS}d` },
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload & AuthUser & { tv?: number };
    if (!payload.id || !payload.username || (payload.role !== "admin" && payload.role !== "staff")) {
      return null;
    }
    const tokenVersion = Number(payload.tv ?? payload.tokenVersion) || 0;
    const cached = tokenVersionByUser.get(payload.id);
    if (cached !== undefined && cached !== tokenVersion) {
      return null;
    }
    return { id: payload.id, username: payload.username, role: payload.role, tokenVersion };
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

function allowsMustChangePassword(req: Request): boolean {
  const url = (req.originalUrl || req.url || "").split("?")[0] ?? "";
  if (req.method === "POST" && url.endsWith("/auth/change-password")) return true;
  if (req.method === "GET" && url.endsWith("/auth/me")) return true;
  return false;
}

export async function resolveAuthUser(user: AuthUser): Promise<AuthUser | null> {
  const dbUser = await UserModel.findOne({ id: user.id }).lean();
  if (!dbUser) return null;
  const tokenVersion = dbUser.tokenVersion ?? 0;
  rememberTokenVersion(dbUser.id, tokenVersion);
  if ((user.tokenVersion ?? 0) !== tokenVersion) return null;
  return {
    id: dbUser.id,
    username: dbUser.username,
    role: dbUser.role,
    tokenVersion,
    mustChangePassword: Boolean(dbUser.mustChangePassword),
  };
}

export function requireAuth(roles?: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const tokenUser = getRequestAuth(req);
      if (!tokenUser) {
        res.status(401).json({ error: "ກະລຸນາເຂົ້າສູ່ລະບົບ." });
        return;
      }
      if (roles && !roles.includes(tokenUser.role)) {
        res.status(403).json({ error: "ທ່ານບໍ່ມີສິດເຂົ້າໜ້ານີ້." });
        return;
      }
      const user = await resolveAuthUser(tokenUser);
      if (!user) {
        res.status(401).json({ error: "ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່." });
        return;
      }
      req.auth = user;
      if (user.mustChangePassword && !allowsMustChangePassword(req)) {
        res.status(403).json({
          error: "ກະລຸນາປ່ຽນລະຫັດຜ່ານເລີ່ມຕົ້ນກ່ອນເຂົ້າໃຊ້ງານ.",
          mustChangePassword: true,
        });
        return;
      }
      next();
    })().catch(next);
  };
}

export const requireAdmin = requireAuth(["admin"]);
export const requireStaffOrAdmin = requireAuth(["admin", "staff"]);

export async function ensureDefaultUsers(): Promise<void> {
  const now = new Date().toISOString();
  const defaults: { username: string; password: string; role: UserRole; name: string }[] = [
    { username: "admin", password: DEFAULT_PASSWORD, role: "admin", name: "ເຈົ້າຂອງຮ້ານ" },
    { username: "staff", password: DEFAULT_PASSWORD, role: "staff", name: "ພະນັກງານ" },
  ];

  for (const row of defaults) {
    try {
      const exists = await UserModel.findOne({ username: row.username }).lean();
      if (exists) {
        const patch: Record<string, unknown> = {};
        if (!exists.name) patch.name = row.name;
        if (typeof exists.tokenVersion !== "number") patch.tokenVersion = 0;
        if (typeof exists.mustChangePassword !== "boolean") {
          patch.mustChangePassword = await verifyPassword(DEFAULT_PASSWORD, exists.passwordHash);
        } else if (!exists.mustChangePassword && (await verifyPassword(DEFAULT_PASSWORD, exists.passwordHash))) {
          patch.mustChangePassword = true;
        }
        if (Object.keys(patch).length > 0) {
          await UserModel.updateOne({ id: exists.id }, { $set: patch });
        }
        rememberTokenVersion(
          exists.id,
          typeof patch.tokenVersion === "number" ? patch.tokenVersion : (exists.tokenVersion ?? 0),
        );
        continue;
      }
      const createdId = randomUUID();
      await UserModel.create({
        id: createdId,
        username: row.username,
        name: row.name,
        passwordHash: await hashPassword(row.password),
        role: row.role,
        tokenVersion: 0,
        mustChangePassword: true,
        createdAt: now,
      });
      rememberTokenVersion(createdId, 0);
      console.log(`Seeded ${row.role} user: ${row.username}`);
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? (err as { code?: number }).code : 0;
      if (code !== 11000) throw err;
    }
  }

  const users = await UserModel.find({}, { id: 1, tokenVersion: 1 }).lean();
  for (const user of users) {
    rememberTokenVersion(user.id, user.tokenVersion ?? 0);
  }
}
