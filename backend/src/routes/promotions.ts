import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "../lib/auth.js";
import { toPublic, toPublicList } from "../lib/serialize.js";
import { PromotionModel } from "../models/promotion.js";
import type { Promotion } from "../types.js";

export const promotionsRouter = Router();

const TITLE_MAX = 80;
const BODY_MAX = 1000;
const CODE_MAX = 40;
const IMAGE_MAX = 2000;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCode(value: unknown): string {
  return asText(value).replace(/\s+/g, "").toUpperCase();
}

function parsePromotion(body: Record<string, unknown>): { error: string } | Omit<Promotion, "id" | "createdAt" | "updatedAt"> {
  const title = asText(body.title);
  const bodyText = asText(body.body);
  const code = normalizeCode(body.code);
  const image = asText(body.image);
  const active = body.active !== false;

  if (!title) return { error: "ກະລຸນາໃສ່ຫົວຂໍ້ໂປຣໂມຊັນ." };
  if (title.length > TITLE_MAX) return { error: "ຫົວຂໍ້ຍາວເກີນໄປ." };
  if (bodyText.length > BODY_MAX) return { error: "ຂໍ້ຄວາມແຈ້ງການຍາວເກີນໄປ." };
  if (code.length > CODE_MAX) return { error: "ລະຫັດສ່ວນຫຼຸດຍາວເກີນໄປ." };
  if (image.length > IMAGE_MAX) return { error: "URL ຮູບບໍ່ຖືກຕ້ອງ." };

  return { title, body: bodyText, code, image, active };
}

async function codeTaken(code: string, exceptId?: string): Promise<boolean> {
  if (!code) return false;
  const filter: Record<string, unknown> = { code };
  if (exceptId) filter.id = { $ne: exceptId };
  return Boolean(await PromotionModel.exists(filter));
}

promotionsRouter.get("/promotions", async (_req, res) => {
  const docs = await PromotionModel.find({ active: true }).sort({ createdAt: -1 }).lean();
  res.json(toPublicList<Promotion>(docs));
});

promotionsRouter.get("/promotions/all", requireAdmin, async (_req, res) => {
  const docs = await PromotionModel.find().sort({ createdAt: -1 }).lean();
  res.json(toPublicList<Promotion>(docs));
});

promotionsRouter.post("/promotions", requireAdmin, async (req, res) => {
  const parsed = parsePromotion((req.body ?? {}) as Record<string, unknown>);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  if (await codeTaken(parsed.code)) {
    res.status(400).json({ error: "ລະຫັດສ່ວນຫຼຸດນີ້ມີແລ້ວ." });
    return;
  }

  const now = new Date().toISOString();
  const promotion: Promotion = {
    id: randomUUID(),
    ...parsed,
    createdAt: now,
    updatedAt: now,
  };
  await PromotionModel.create(promotion);
  res.status(201).json(promotion);
});

promotionsRouter.put("/promotions/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const parsed = parsePromotion((req.body ?? {}) as Record<string, unknown>);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  if (await codeTaken(parsed.code, id)) {
    res.status(400).json({ error: "ລະຫັດສ່ວນຫຼຸດນີ້ມີແລ້ວ." });
    return;
  }

  const updated = toPublic<Promotion>(
    await PromotionModel.findOneAndUpdate(
      { id },
      { $set: { ...parsed, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    ).lean(),
  );
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບໂປຣໂມຊັນ." });
    return;
  }
  res.json(updated);
});

promotionsRouter.patch("/promotions/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const active = (req.body as { active?: unknown } | undefined)?.active;
  if (typeof active !== "boolean") {
    res.status(400).json({ error: "ສະຖານະໂປຣໂມຊັນບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const updated = toPublic<Promotion>(
    await PromotionModel.findOneAndUpdate(
      { id },
      { $set: { active, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    ).lean(),
  );
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບໂປຣໂມຊັນ." });
    return;
  }
  res.json(updated);
});

promotionsRouter.delete("/promotions/:id", requireAdmin, async (req, res) => {
  const removed = await PromotionModel.findOneAndDelete({ id: String(req.params.id ?? "") });
  if (!removed) {
    res.status(404).json({ error: "ບໍ່ພົບໂປຣໂມຊັນ." });
    return;
  }
  res.status(204).send();
});
