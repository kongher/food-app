import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAdmin, requireStaffOrAdmin } from "../lib/auth.js";
import { toPublic } from "../lib/serialize.js";
import { OrderModel } from "../models/order.js";
import { StaffCallModel } from "../models/staffCall.js";
import { TableModel } from "../models/table.js";
import type { DiningTable } from "../types.js";

export const tablesRouter = Router();

function asTable(doc: unknown, busy: { orders: Set<number>; calls: Set<number> }): DiningTable | null {
  const row = toPublic<{ id: string; number: number; occupied?: boolean; createdAt: string }>(doc);
  if (!row) return null;
  const number = Number(row.number);
  const occupied = Boolean(row.occupied) || busy.orders.has(number);
  const hasCall = busy.calls.has(number);
  return {
    id: row.id,
    number,
    status: occupied || hasCall ? "busy" : "empty",
    occupied,
    hasOrder: occupied,
    hasCall,
    createdAt: row.createdAt,
  };
}

async function occupancy(): Promise<{ orders: Set<number>; calls: Set<number> }> {
  const [orderNumbers, callNumbers] = await Promise.all([
    OrderModel.distinct("tableNumber", { status: "pending" }),
    StaffCallModel.distinct("tableNumber", { status: "pending" }),
  ]);
  const orders = new Set(orderNumbers.map(Number));
  if (orders.size > 0) {
    await TableModel.updateMany(
      { number: { $in: [...orders] }, occupied: { $ne: true } },
      { $set: { occupied: true } },
    );
  }
  return {
    orders,
    calls: new Set(callNumbers.map(Number)),
  };
}

tablesRouter.get("/tables", requireStaffOrAdmin, async (_req, res) => {
  const busy = await occupancy();
  const docs = await TableModel.find().sort({ number: 1 }).lean();
  const tables = docs
    .map((doc) => asTable(doc, busy))
    .filter((table): table is DiningTable => table !== null);
  res.json(tables);
});

tablesRouter.post("/tables", requireAdmin, async (req, res) => {
  const number = Number((req.body as { number?: unknown } | undefined)?.number);
  if (!Number.isInteger(number) || number <= 0) {
    res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const exists = await TableModel.exists({ number });
  if (exists) {
    res.status(400).json({ error: "ໂຕະນີ້ມີແລ້ວ." });
    return;
  }

  const table = {
    id: randomUUID(),
    number,
    occupied: false,
    createdAt: new Date().toISOString(),
  };
  await TableModel.create(table);
  const busy = await occupancy();
  res.status(201).json(asTable(table, busy));
});

tablesRouter.patch("/tables/:id", requireStaffOrAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const occupied = (req.body as { occupied?: unknown } | undefined)?.occupied;
  if (occupied !== false) {
    res.status(400).json({ error: "ສະຖານະໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const updated = await TableModel.findOneAndUpdate({ id }, { $set: { occupied: false } }, { returnDocument: "after" }).lean();
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  const busy = await occupancy();
  res.json(asTable(updated, busy));
});

tablesRouter.delete("/tables/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const removed = await TableModel.findOneAndDelete({ id });
  if (!removed) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }
  res.status(204).send();
});
