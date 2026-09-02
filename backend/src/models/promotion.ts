import mongoose, { Schema } from "mongoose";
import type { Promotion } from "../types.js";

const promotionSchema = new Schema<Promotion>(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    code: { type: String, default: "", trim: true, index: true },
    image: { type: String, default: "" },
    active: { type: Boolean, default: true, index: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false, collection: "promotions" },
);

export const PromotionModel = mongoose.model<Promotion>("Promotion", promotionSchema);
