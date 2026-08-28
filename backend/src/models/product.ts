import mongoose, { Schema } from "mongoose";
import type { Product } from "../types.js";

const productSchema = new Schema<Product>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    categoryId: { type: String, required: true, index: true },
    available: { type: Boolean, default: true },
  },
  { versionKey: false, collection: "products" },
);

export const ProductModel = mongoose.model<Product>("Product", productSchema);
