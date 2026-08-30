import { randomUUID } from "node:crypto";
import { Router } from "express";
import { hashPassword, rememberTokenVersion, requireAdmin } from "../lib/auth.js";
import type { UserAccount } from "../lib/authTypes.js";
import { DEFAULT_PASSWORD } from "../lib/password.js";
import { toPublic } from "../lib/serialize.js";
import { disconnectUserSockets } from "../lib/socket.js";
import { UserModel } from "../models/user.js";

export const staffRouter = Router();
staffRouter.use("/staff", requireAdmin);

export type PublicStaff = {
  id: string;
  username: string;
  name: string;
  role: "staff";
  createdAt: string;
  mustChangePassword: boolean;
};

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isDuplicateKey(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? (err as { code?: number }).code : 0;
  return code === 11000;
}

function toPublicStaff(doc: unknown): PublicStaff | null {
  const row = toPublic<UserAccount>(doc);
  if (!row || row.role !== "staff") return null;
  return {
    id: row.id,
    username: row.username,
    name: (row.name || "").trim() || row.username,
    role: "staff",
    createdAt: row.createdAt,
    mustChangePassword: Boolean(row.mustChangePassword),
  };
}

function parseUsername(value: unknown): { error: string } | { username: string } {
  const username = asString(value).toLowerCase();
  if (!username) return { error: "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້." };
  if (!USERNAME_RE.test(username)) {
    return { error: "ຊື່ຜູ້ໃຊ້ຕ້ອງມີ 3-32 ຕົວອັກສອນ a-z, 0-9, . _ -" };
  }
  return { username };
}

function parsePassword(value: unknown, required: boolean): { error: string } | { password: string | null } {
  const password = typeof value === "string" ? value : "";
  if (!password) {
    if (required) return { error: "ກະລຸນາໃສ່ລະຫັດຜ່ານ." };
    return { password: null };
  }
  if (password.length < 6) return { error: "ລະຫັດຜ່ານຕ້ອງມີຢ່າງນ້ອຍ 6 ຕົວອັກສອນ." };
  if (password.length > 100) return { error: "ລະຫັດຜ່ານຍາວເກີນໄປ." };
  return { password };
}

function parseName(value: unknown, fallback: string): { error: string } | { name: string } {
  const name = asString(value) || fallback;
  if (!name) return { error: "ກະລຸນາໃສ່ຊື່ພະນັກງານ." };
  if (name.length > 80) return { error: "ຊື່ພະນັກງານຍາວເກີນໄປ." };
  return { name };
}

staffRouter.get("/staff", async (_req, res) => {
  const docs = await UserModel.find({ role: "staff" }).sort({ createdAt: -1 }).lean();
  res.json(docs.map(toPublicStaff).filter((item): item is PublicStaff => item !== null));
});

staffRouter.post("/staff", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const username = parseUsername(body.username);
  if ("error" in username) {
    res.status(400).json({ error: username.error });
    return;
  }
  const name = parseName(body.name, username.username);
  if ("error" in name) {
    res.status(400).json({ error: name.error });
    return;
  }

  try {
    const createdId = randomUUID();
    const created = await UserModel.create({
      id: createdId,
      username: username.username,
      name: name.name,
      passwordHash: await hashPassword(DEFAULT_PASSWORD),
      role: "staff",
      tokenVersion: 0,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    });
    rememberTokenVersion(createdId, 0);
    res.status(201).json(toPublicStaff(created.toObject()));
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(400).json({ error: "ຊື່ຜູ້ໃຊ້ນີ້ມີແລ້ວ." });
      return;
    }
    throw err;
  }
});

staffRouter.put("/staff/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = toPublic<UserAccount>(await UserModel.findOne({ id, role: "staff" }).lean());
  if (!existing) {
    res.status(404).json({ error: "ບໍ່ພົບບັນຊີພະນັກງານ." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const username = parseUsername(body.username !== undefined ? body.username : existing.username);
  if ("error" in username) {
    res.status(400).json({ error: username.error });
    return;
  }
  const name = parseName(body.name !== undefined ? body.name : existing.name, username.username);
  if ("error" in name) {
    res.status(400).json({ error: name.error });
    return;
  }
  const password = parsePassword(body.password, false);
  if ("error" in password) {
    res.status(400).json({ error: password.error });
    return;
  }

  const update: Partial<UserAccount> = {
    username: username.username,
    name: name.name,
  };
  if (password.password) {
    update.passwordHash = await hashPassword(password.password);
    update.tokenVersion = (existing.tokenVersion ?? 0) + 1;
    update.mustChangePassword = password.password === DEFAULT_PASSWORD;
  }

  try {
    const updated = toPublicStaff(
      await UserModel.findOneAndUpdate({ id, role: "staff" }, { $set: update }, { returnDocument: "after" }).lean(),
    );
    if (!updated) {
      res.status(404).json({ error: "ບໍ່ພົບບັນຊີພະນັກງານ." });
      return;
    }
    if (typeof update.tokenVersion === "number") {
      rememberTokenVersion(id, update.tokenVersion);
      disconnectUserSockets(id);
    }
    res.json(updated);
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(400).json({ error: "ຊື່ຜູ້ໃຊ້ນີ້ມີແລ້ວ." });
      return;
    }
    throw err;
  }
});

staffRouter.delete("/staff/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const removed = await UserModel.findOneAndDelete({ id, role: "staff" });
  if (!removed) {
    res.status(404).json({ error: "ບໍ່ພົບບັນຊີພະນັກງານ." });
    return;
  }
  res.status(204).send();
});
