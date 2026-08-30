import mongoose, { Schema } from "mongoose";
import type { SongRequest } from "../types.js";

const songRequestSchema = new Schema<SongRequest>(
  {
    id: { type: String, required: true, unique: true },
    tableNumber: { type: Number, required: true, min: 1, index: true },
    title: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false, collection: "songRequests" },
);

songRequestSchema.index({ createdAt: -1 });
songRequestSchema.index({ tableNumber: 1, createdAt: -1 });

export const SongRequestModel = mongoose.model<SongRequest>("SongRequest", songRequestSchema);
