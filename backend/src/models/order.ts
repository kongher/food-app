import { randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import type { Order, OrderItem } from "../types.js";

const orderItemSchema = new Schema<OrderItem>(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const orderSchema = new Schema<Order>(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, unique: true, sparse: true, index: true },
    tableNumber: { type: Number, required: true, min: 1 },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "completed"], default: "pending", index: true },
    paymentMethod: { type: String, enum: ["cash", "transfer"], required: false },
    paidAt: { type: String, required: false },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, collection: "orders" },
);

orderSchema.index({ createdAt: -1 });

export const OrderModel = mongoose.model<Order>("Order", orderSchema);

export function formatOrderCode(at: Date, suffix: string): string {
  const yy = String(at.getFullYear()).slice(-2);
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const dd = String(at.getDate()).padStart(2, "0");
  return `ORD-${yy}${mm}${dd}-${suffix}`;
}

export function fallbackOrderCode(id: string, createdAt: string): string {
  const at = new Date(createdAt);
  const date = Number.isNaN(at.getTime()) ? new Date() : at;
  const suffix = id.replace(/-/g, "").slice(-4).toUpperCase();
  return formatOrderCode(date, suffix);
}

export async function uniqueOrderCode(at = new Date()): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomBytes(2).toString("hex").toUpperCase();
    const code = formatOrderCode(at, suffix);
    const exists = await OrderModel.exists({ code });
    if (!exists) return code;
  }
  return formatOrderCode(at, randomBytes(3).toString("hex").toUpperCase());
}

export function withOrderCode<T extends { id: string; createdAt: string; code?: string }>(order: T): T & { code: string } {
  return { ...order, code: order.code || fallbackOrderCode(order.id, order.createdAt) };
}
