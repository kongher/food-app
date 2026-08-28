import { Router } from "express";
import { signAuthToken, verifyPassword } from "../lib/auth.js";
import { UserModel } from "../models/user.js";

export const authRouter = Router();

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

  const auth = { id: user.id, username: user.username, role: user.role };
  res.json({
    token: signAuthToken(auth),
    role: auth.role,
    username: auth.username,
  });
});
