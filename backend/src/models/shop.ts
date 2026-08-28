import mongoose, { Schema } from "mongoose";
import type { Shop } from "../types.js";

export const DEFAULT_SHOP_ID = "default";
export const DEFAULT_SHOP_NAME = "ຮ້ານອາຫານແຊບ";

const shopSchema = new Schema<Shop>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false, collection: "shops" },
);

export const ShopModel = mongoose.model<Shop>("Shop", shopSchema);

export function defaultShop(now = new Date().toISOString()): Shop {
  return {
    id: DEFAULT_SHOP_ID,
    name: DEFAULT_SHOP_NAME,
    logo: "",
    updatedAt: now,
  };
}

export async function ensureDefaultShop(): Promise<void> {
  const existing = await ShopModel.findOne({ id: DEFAULT_SHOP_ID }).lean();
  if (existing) return;
  await ShopModel.create(defaultShop());
}
