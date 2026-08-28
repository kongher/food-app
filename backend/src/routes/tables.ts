import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAdmin, requireStaffOrAdmin } from "../lib/auth.js";
import { toPublic } from "../lib/serialize.js";
import { OrderModel } from "../models/order.js";
import { StaffCallModel } from "../models/staffCall.js";
import { TableModel } from "../models/table.js";
import type { DiningTable } from "../types.js";

export const tablesRouter = Router();

type Occupancy = {
  orders: Set<number>;
  calls: Set<number>;
  startedAt: Map<number, string>;
};

function asTable(doc: unknown, busy: Occupancy): DiningTable | null {
  const row = toPublic<{ id: string; number: number; occupied?: boolean; occupiedAt?: string | null; createdAt: string }>(
    doc,
  );
  if (!row) return null;
  const number = Number(row.number);
  const occupied = Boolean(row.occupied) || busy.orders.has(number);
  const hasCall = busy.calls.has(number);
  const storedAt = typeof row.occupiedAt === "string" && row.occupiedAt ? row.occupiedAt : null;
  return {
    id: row.id,
    number,
    status: occupied || hasCall ? "busy" : "empty",
    occupied,
    occupiedAt: occupied ? storedAt || busy.startedAt.get(number) || null : null,
    hasOrder: occupied,
    hasCall,
    createdAt: row.createdAt,
  };
}

async function occupancy(): Promise<Occupancy> {
  const [pendingOrders, callNumbers] = await Promise.all([
    OrderModel.find({ status: "pending" }, { tableNumber: 1, createdAt: 1 }).lean(),
    StaffCallModel.distinct("tableNumber", { status: "pending" }),
  ]);

  const startedAt = new Map<number, string>();
  for (const order of pendingOrders) {
    const number = Number(order.tableNumber);
    const createdAt = typeof order.createdAt === "string" ? order.createdAt : "";
    if (!Number.isInteger(number) || !createdAt) continue;
    const previous = startedAt.get(number);
    if (!previous || createdAt < previous) startedAt.set(number, createdAt);
  }

  const orders = new Set(startedAt.keys());
  if (orders.size > 0) {
    const ops = [...startedAt.entries()].map(([number, occupiedAt]) => ({
      updateOne: {
        filter: {
          number,
          $or: [{ occupied: { $ne: true } }, { occupiedAt: null }, { occupiedAt: "" }, { occupiedAt: { $exists: false } }],
        },
        update: { $set: { occupied: true, occupiedAt } },
      },
    }));
    await TableModel.bulkWrite(ops);
  }

  return {
    orders,
    calls: new Set(callNumbers.map(Number)),
    startedAt,
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
    occupiedAt: null,
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

  const updated = await TableModel.findOneAndUpdate(
    { id },
    { $set: { occupied: false, occupiedAt: null } },
    { returnDocument: "after" },
  ).lean();
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
