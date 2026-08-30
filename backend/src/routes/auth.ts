import { Router } from "express";
import rateLimit from "express-rate-limit";
import { hashPassword, rememberTokenVersion, requireStaffOrAdmin, signAuthToken, verifyPassword } from "../lib/auth.js";
import { UserModel } from "../models/user.js";
import { DEFAULT_PASSWORD, passwordPolicyError } from "../lib/password.js";
import { disconnectUserSockets } from "../lib/socket.js";

export const authRouter = Router();

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ທ່ານລອງປ່ຽນລະຫັດຜ່ານເລື້ອຍເກີນໄປ, ກະລຸນາລອງໃໝ່ພາຍຫຼັງ." },
});

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

authRouter.post("/auth/login", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    res.status(400).json({ error: "ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ." });
    return;
  }

  const user = await UserModel.findOne({ username }).lean();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ." });
    return;
  }

  let mustChangePassword = Boolean(user.mustChangePassword);
  if (password === DEFAULT_PASSWORD) {
    mustChangePassword = true;
    if (!user.mustChangePassword) {
      await UserModel.updateOne({ id: user.id }, { $set: { mustChangePassword: true } });
    }
  }

  const tokenVersion = user.tokenVersion ?? 0;
  rememberTokenVersion(user.id, tokenVersion);
  const auth = {
    id: user.id,
    username: user.username,
    role: user.role,
    tokenVersion,
    mustChangePassword,
  };
  res.json({
    token: signAuthToken(auth),
    role: auth.role,
    username: auth.username,
    mustChangePassword,
  });
});

authRouter.get("/auth/me", requireStaffOrAdmin, async (req, res) => {
  res.json({
    id: req.auth?.id,
    username: req.auth?.username,
    role: req.auth?.role,
    mustChangePassword: Boolean(req.auth?.mustChangePassword),
  });
});

authRouter.post("/auth/change-password", changePasswordLimiter, requireStaffOrAdmin, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "ກະລຸນາເຂົ້າສູ່ລະບົບ." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const currentPassword = asString(body.currentPassword);
  const newPassword = asString(body.newPassword);
  const confirmPassword = asString(body.confirmPassword);

  if (!currentPassword) {
    res.status(400).json({ error: "ກະລຸນາໃສ່ລະຫັດຜ່ານປັດຈຸບັນ." });
    return;
  }
  if (confirmPassword !== newPassword) {
    res.status(400).json({ error: "ລະຫັດຜ່ານໃໝ່ບໍ່ກົງກັນ. ກະລຸນາໃສ່ຄືນ 2 ຄັ້ງ." });
    return;
  }
  const policyError = passwordPolicyError(newPassword);
  if (policyError) {
    res.status(400).json({ error: policyError });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: "ລະຫັດຜ່ານໃໝ່ຕ້ອງແຕກຕ່າງຈາກລະຫັດປັດຈຸບັນ." });
    return;
  }

  const user = await UserModel.findOne({ id: auth.id });
  if (!user || (user.role !== "admin" && user.role !== "staff")) {
    res.status(401).json({ error: "ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່." });
    return;
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    res.status(400).json({ error: "ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion = tokenVersion;
  user.mustChangePassword = false;
  await user.save();
  rememberTokenVersion(auth.id, tokenVersion);
  disconnectUserSockets(auth.id);

  const nextAuth = {
    id: auth.id,
    username: user.username,
    role: user.role,
    tokenVersion,
    mustChangePassword: false,
  };
  res.json({
    token: signAuthToken(nextAuth),
    role: nextAuth.role,
    username: nextAuth.username,
    mustChangePassword: false,
  });
});
