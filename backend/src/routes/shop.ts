import { Router } from "express";
import { toPublic } from "../lib/serialize.js";
import { requireAdmin } from "../lib/auth.js";
import { DEFAULT_SHOP_ID, DEFAULT_SHOP_NAME, ShopModel, defaultShop } from "../models/shop.js";
import type { Shop } from "../types.js";

export const shopRouter = Router();

function asShop(doc: unknown): Shop {
  const shop = toPublic<Shop>(doc);
  if (!shop) return defaultShop();
  return {
    id: shop.id || DEFAULT_SHOP_ID,
    name: shop.name?.trim() || DEFAULT_SHOP_NAME,
    logo: typeof shop.logo === "string" ? shop.logo.trim() : "",
    updatedAt: shop.updatedAt || new Date().toISOString(),
  };
}

async function getOrCreateShop(): Promise<Shop> {
  const existing = await ShopModel.findOne({ id: DEFAULT_SHOP_ID }).lean();
  if (existing) return asShop(existing);
  const created = defaultShop();
  await ShopModel.create(created);
  return created;
}

shopRouter.get("/shop", async (_req, res) => {
  res.json(await getOrCreateShop());
});

shopRouter.put("/shop", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const logo = typeof body.logo === "string" ? body.logo.trim() : "";

  if (!name) {
    res.status(400).json({ error: "ກະລຸນາໃສ່ຊື່ຮ້ານ." });
    return;
  }
  if (name.length > 80) {
    res.status(400).json({ error: "ຊື່ຮ້ານຍາວເກີນໄປ." });
    return;
  }
  if (logo.length > 2000) {
    res.status(400).json({ error: "URL ໂລໂກ້ບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const now = new Date().toISOString();
  const updated = asShop(
    await ShopModel.findOneAndUpdate(
      { id: DEFAULT_SHOP_ID },
      {
        $set: { name, logo, updatedAt: now },
        $setOnInsert: { id: DEFAULT_SHOP_ID },
      },
      { upsert: true, returnDocument: "after" },
    ).lean(),
  );

  res.json(updated);
});
