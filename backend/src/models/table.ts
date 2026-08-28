import { randomUUID } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import type { DiningTable } from "../types.js";

const tableSchema = new Schema<Pick<DiningTable, "id" | "number" | "occupied" | "createdAt">>(
  {
    id: { type: String, required: true, unique: true },
    number: { type: Number, required: true, unique: true, min: 1 },
    occupied: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, collection: "tables" },
);

export const TableModel = mongoose.model("DiningTable", tableSchema);

export async function markTableOccupied(tableNumber: number): Promise<void> {
  await TableModel.updateOne({ number: tableNumber }, { $set: { occupied: true } });
}

const DEFAULT_TABLE_COUNT = 20;

export async function ensureDefaultTables(): Promise<void> {
  const existing = await TableModel.find({}, { number: 1 }).lean();
  const have = new Set(existing.map((row) => Number(row.number)));
  const now = new Date().toISOString();
  const missing = [];
  for (let number = 1; number <= DEFAULT_TABLE_COUNT; number += 1) {
    if (have.has(number)) continue;
    missing.push({ id: randomUUID(), number, createdAt: now });
  }
  if (missing.length === 0) return;
  try {
    await TableModel.insertMany(missing, { ordered: false });
    console.log(`Seeded ${missing.length} tables`);
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: number }).code : 0;
    if (code !== 11000) throw err;
  }
}
