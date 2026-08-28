import mongoose, { Schema } from "mongoose";
import type { Category } from "../types.js";

const categorySchema = new Schema<Category>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
  },
  { versionKey: false, collection: "categories" },
);

export const CategoryModel = mongoose.model<Category>("Category", categorySchema);
