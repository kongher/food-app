import { randomUUID } from "node:crypto";
import mongoose, { Schema } from "mongoose";

type TableDoc = {
  id: string;
  number: number;
  occupied?: boolean;
  occupiedAt?: string | null;
  locked?: boolean;
  sessionId?: string | null;
  createdAt: string;
};

const tableSchema = new Schema<TableDoc>(
  {
    id: { type: String, required: true, unique: true },
    number: { type: Number, required: true, unique: true, min: 1 },
    occupied: { type: Boolean, default: false },
    occupiedAt: { type: String, default: null },
    locked: { type: Boolean, default: false },
    sessionId: { type: String, default: null },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, collection: "tables" },
);

export const TableModel = mongoose.model("DiningTable", tableSchema);

export function guestAccessError(table: { occupied?: boolean; locked?: boolean } | null): string | null {
  if (!table) return "ບໍ່ພົບໂຕະນີ້.";
  if (table.locked) return "ໂຕະນີ້ຖືກລັອກແລ້ວ. ກະລຸນາຕິດຕໍ່ພະນັກງານ.";
  if (!table.occupied) return "ໂຕະຍັງບໍ່ໄດ້ເປີດ. ກະລຸນາຕິດຕໍ່ພະນັກງານ.";
  return null;
}

export async function openTableSession(tableNumber: number, at = new Date().toISOString()): Promise<void> {
  const table = await TableModel.findOne({ number: tableNumber }).lean();
  if (!table) return;
  if (table.occupied && table.sessionId) return;
  await TableModel.updateOne(
    { number: tableNumber },
    {
      $set: {
        occupied: true,
        occupiedAt: table.occupiedAt || at,
        locked: false,
        sessionId: table.sessionId || randomUUID(),
      },
    },
  );
}

const DEFAULT_TABLE_COUNT = 20;

export async function ensureDefaultTables(): Promise<void> {
  const existing = await TableModel.find({}, { number: 1 }).lean();
  const have = new Set(existing.map((row) => Number(row.number)));
  const now = new Date().toISOString();
  const missing = [];
  for (let number = 1; number <= DEFAULT_TABLE_COUNT; number += 1) {
    if (have.has(number)) continue;
    missing.push({ id: randomUUID(), number, occupied: false, occupiedAt: null, locked: false, sessionId: null, createdAt: now });
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
