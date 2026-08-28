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
    tableNumber: { type: Number, required: true, min: 1 },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "completed"], default: "pending", index: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, collection: "orders" },
);

orderSchema.index({ createdAt: -1 });

export const OrderModel = mongoose.model<Order>("Order", orderSchema);
