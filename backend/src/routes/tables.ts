import { Router } from "express";
import { randomUUID } from "node:crypto";
import { broadcastCalls, broadcastOrders, broadcastSongs, broadcastTables } from "../events.js";
import { requireAdmin, requireStaffOrAdmin } from "../lib/auth.js";
import { toPublic } from "../lib/serialize.js";
import { OrderModel } from "../models/order.js";
import { SongRequestModel } from "../models/songRequest.js";
import { StaffCallModel } from "../models/staffCall.js";
import { TableModel } from "../models/table.js";
import type { DiningTable, GuestTableStatus, PublicTableStatus, TableAction } from "../types.js";

export const tablesRouter = Router();

type Occupancy = {
  orders: Set<number>;
  calls: Set<number>;
  startedAt: Map<number, string>;
};

type TableRow = {
  id: string;
  number: number;
  occupied?: boolean;
  occupiedAt?: string | null;
  locked?: boolean;
  createdAt: string;
};

function asTable(doc: unknown, busy: Occupancy): DiningTable | null {
  const row = toPublic<TableRow>(doc);
  if (!row) return null;
  const number = Number(row.number);
  const occupied = Boolean(row.occupied);
  const locked = Boolean(row.locked) && !occupied;
  const hasCall = busy.calls.has(number);
  const storedAt = typeof row.occupiedAt === "string" && row.occupiedAt ? row.occupiedAt : null;
  return {
    id: row.id,
    number,
    status: locked ? "locked" : occupied || hasCall ? "busy" : "empty",
    occupied,
    locked,
    occupiedAt: occupied ? storedAt || busy.startedAt.get(number) || null : null,
    hasOrder: occupied,
    hasCall,
    createdAt: row.createdAt,
  };
}

function publicStatus(table: { number: number; occupied?: boolean; locked?: boolean }): PublicTableStatus {
  const occupied = Boolean(table.occupied);
  const locked = Boolean(table.locked) && !occupied;
  const status: GuestTableStatus = locked ? "locked" : occupied ? "occupied" : "empty";
  return {
    number: Number(table.number),
    status,
    canOrder: status === "occupied",
    canCall: status === "occupied",
  };
}

function parseAction(body: { action?: unknown; occupied?: unknown; locked?: unknown }): TableAction | null {
  if (body.action === "open" || body.action === "close" || body.action === "lock" || body.action === "unlock") {
    return body.action;
  }
  if (body.occupied === true) return "open";
  if (body.occupied === false) return "close";
  if (body.locked === true) return "lock";
  if (body.locked === false) return "unlock";
  return null;
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

  return {
    orders: new Set(startedAt.keys()),
    calls: new Set(callNumbers.map(Number)),
    startedAt,
  };
}

tablesRouter.get("/tables/status/:number", async (req, res) => {
  const number = Number(req.params.number);
  if (!Number.isInteger(number) || number <= 0) {
    res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const table = await TableModel.findOne({ number }).lean();
  if (!table) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  res.json(publicStatus(table));
});

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
    locked: false,
    sessionId: null,
    createdAt: new Date().toISOString(),
  };
  await TableModel.create(table);
  const busy = await occupancy();
  res.status(201).json(asTable(table, busy));
});

tablesRouter.patch("/tables/:id", requireStaffOrAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const action = parseAction((req.body ?? {}) as { action?: unknown; occupied?: unknown; locked?: unknown });
  if (!action) {
    res.status(400).json({ error: "ສະຖານະໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const current = await TableModel.findOne({ id }).lean();
  if (!current) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  const now = new Date().toISOString();
  let update: Record<string, unknown>;

  if (action === "open") {
    update = {
      occupied: true,
      occupiedAt: current.occupied && current.occupiedAt ? current.occupiedAt : now,
      locked: false,
      sessionId: current.occupied && current.sessionId ? current.sessionId : randomUUID(),
    };
  } else if (action === "close") {
    update = { occupied: false, occupiedAt: null, locked: false, sessionId: null };
  } else if (action === "lock") {
    if (current.occupied) {
      res.status(400).json({ error: "ກະລຸນາປິດໂຕະກ່ອນລັອກ." });
      return;
    }
    update = { occupied: false, occupiedAt: null, locked: true, sessionId: null };
  } else {
    update = { occupied: false, occupiedAt: null, locked: false, sessionId: null };
  }

  const updated = await TableModel.findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" }).lean();
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  if (action === "close") {
    const pending = await StaffCallModel.find({ tableNumber: current.number, status: "pending" }, { id: 1 }).lean();
    if (pending.length > 0) {
      await StaffCallModel.updateMany(
        { tableNumber: current.number, status: "pending" },
        { $set: { status: "done", updatedAt: now } },
      );
      broadcastCalls({ type: "updated", callId: String(pending[0]?.id ?? ""), tableNumber: current.number });
    }
  }

  broadcastTables({ type: "updated", tableNumber: current.number });
  const busy = await occupancy();
  res.json(asTable(updated, busy));
});

tablesRouter.post("/tables/:id/transfer", requireStaffOrAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const toNumber = Number((req.body as { toNumber?: unknown } | undefined)?.toNumber);

  if (!Number.isInteger(toNumber) || toNumber <= 0) {
    res.status(400).json({ error: "ເລກໂຕະປາຍທາງບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const source = await TableModel.findOne({ id }).lean();
  if (!source) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  if (!source.occupied) {
    res.status(400).json({ error: "ໂຕະນີ້ຍັງບໍ່ມີລູກຄ້າ." });
    return;
  }

  if (Number(source.number) === toNumber) {
    res.status(400).json({ error: "ກະລຸນາເລືອກໂຕະອື່ນ." });
    return;
  }

  const target = await TableModel.findOne({ number: toNumber }).lean();
  if (!target) {
    res.status(404).json({ error: "ບໍ່ພົບໂຕະປາຍທາງ." });
    return;
  }

  if (target.occupied) {
    res.status(400).json({ error: "ໂຕະປາຍທາງມີລູກຄ້າຢູ່ແລ້ວ." });
    return;
  }

  if (target.locked) {
    res.status(400).json({ error: "ໂຕະປາຍທາງຖືກລັອກ. ກະລຸນາປົດລັອກກ່ອນ." });
    return;
  }

  const fromNumber = Number(source.number);
  const occupiedAt =
    typeof source.occupiedAt === "string" && source.occupiedAt ? source.occupiedAt : null;
  const orderFilter: Record<string, unknown> = { tableNumber: fromNumber };
  if (occupiedAt) {
    orderFilter.$or = [{ status: "pending" }, { status: "completed", createdAt: { $gte: occupiedAt } }];
  } else {
    orderFilter.status = "pending";
  }

  const movedOrders = await OrderModel.find(orderFilter, { id: 1 }).lean();
  await OrderModel.updateMany(orderFilter, { $set: { tableNumber: toNumber } });

  const pendingCalls = await StaffCallModel.find({ tableNumber: fromNumber, status: "pending" }, { id: 1 }).lean();
  if (pendingCalls.length > 0) {
    await StaffCallModel.updateMany({ tableNumber: fromNumber, status: "pending" }, { $set: { tableNumber: toNumber } });
    broadcastCalls({ type: "updated", callId: String(pendingCalls[0]?.id ?? ""), tableNumber: toNumber });
  }

  const songFilter: Record<string, unknown> = { tableNumber: fromNumber };
  if (occupiedAt) {
    songFilter.$or = [{ status: "pending" }, { createdAt: { $gte: occupiedAt } }];
  } else {
    songFilter.status = "pending";
  }
  const movedSongs = await SongRequestModel.find(songFilter, { id: 1 }).lean();
  if (movedSongs.length > 0) {
    await SongRequestModel.updateMany(songFilter, { $set: { tableNumber: toNumber } });
    broadcastSongs({ type: "updated", songId: String(movedSongs[0]?.id ?? ""), tableNumber: toNumber });
  }

  const now = new Date().toISOString();
  const [updatedTarget, updatedSource] = await Promise.all([
    TableModel.findOneAndUpdate(
      { id: target.id },
      {
        $set: {
          occupied: true,
          occupiedAt: occupiedAt || now,
          locked: false,
          sessionId: source.sessionId || randomUUID(),
        },
      },
      { returnDocument: "after" },
    ).lean(),
    TableModel.findOneAndUpdate(
      { id: source.id },
      { $set: { occupied: false, occupiedAt: null, locked: false, sessionId: null } },
      { returnDocument: "after" },
    ).lean(),
  ]);

  if (movedOrders[0]) {
    broadcastOrders({ type: "updated", orderId: String(movedOrders[0].id), tableNumber: toNumber });
  }
  broadcastTables({ type: "updated", tableNumber: fromNumber });
  broadcastTables({ type: "updated", tableNumber: toNumber });

  const busy = await occupancy();
  res.json({
    from: asTable(updatedSource, busy),
    to: asTable(updatedTarget, busy),
  });
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
