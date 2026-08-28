import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { broadcastCalls } from "../events.js";
import { requireStaffOrAdmin } from "../lib/auth.js";
import { toPublic } from "../lib/serialize.js";
import { StaffCallModel } from "../models/index.js";
import type { StaffCall, StaffCallReason, StaffCallStatus } from "../types.js";

export const CALL_REASON_LABELS: Record<StaffCallReason, string> = {
  payment: "ຈ່າຍເງິນ",
  refill: "ເພີ່ມນ້ຳລົ້າ/ນ້ຳກ້ອນ",
  other: "ຕ້ອງການຄວາມຊ່ວຍເຫຼືອອື່ນ",
};

const callLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ທ່ານເອີ້ນພະນັກງານໄວເກີນໄປ, ກະລຸນາລອງໃໝ່ພາຍຫຼັງ." },
});

export const callsRouter = Router();

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 11000;
}

function callTimes(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

function latestAt(call: Pick<StaffCall, "createdAt" | "updatedAt">): string {
  return call.updatedAt || call.createdAt;
}

function publicCall(doc: unknown): StaffCall | null {
  const call = toPublic<StaffCall>(doc);
  if (!call) return null;
  call.times = callTimes(call.times);
  call.updatedAt = call.updatedAt || call.createdAt;
  return call;
}

function sortCalls(calls: StaffCall[]): StaffCall[] {
  return [...calls].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return new Date(latestAt(b)).getTime() - new Date(latestAt(a)).getTime();
  });
}

async function bumpPendingCall(tableNumber: number, reason: StaffCallReason, now: string): Promise<StaffCall | null> {
  const existing = await StaffCallModel.findOne({ tableNumber, reason, status: "pending" }).lean();
  if (!existing) return null;

  const updated = publicCall(
    await StaffCallModel.findOneAndUpdate(
      { id: existing.id, status: "pending" },
      {
        $set: {
          times: callTimes(existing.times) + 1,
          updatedAt: now,
          message: CALL_REASON_LABELS[reason],
        },
      },
      { returnDocument: "after" },
    ).lean(),
  );

  return updated;
}

callsRouter.get("/calls", requireStaffOrAdmin, async (_req, res) => {
  const calls = (await StaffCallModel.find().lean())
    .map((doc) => publicCall(doc))
    .filter((call): call is StaffCall => call !== null);
  res.json(sortCalls(calls));
});

callsRouter.post("/calls", callLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tableNumber = Number(body.tableNumber);
  const reason = body.reason as StaffCallReason;

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }
  if (!(reason in CALL_REASON_LABELS)) {
    res.status(400).json({ error: "ກະລຸນາເລືອກເຫດຜົນ." });
    return;
  }

  const now = new Date().toISOString();
  const bumped = await bumpPendingCall(tableNumber, reason, now);
  if (bumped) {
    broadcastCalls({ type: "repeated", callId: bumped.id, tableNumber });
    res.json(bumped);
    return;
  }

  const call: StaffCall = {
    id: randomUUID(),
    tableNumber,
    reason,
    message: CALL_REASON_LABELS[reason],
    status: "pending",
    times: 1,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await StaffCallModel.create(call);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const retry = await bumpPendingCall(tableNumber, reason, now);
    if (!retry) throw err;
    broadcastCalls({ type: "repeated", callId: retry.id, tableNumber });
    res.json(retry);
    return;
  }

  broadcastCalls({ type: "created", callId: call.id, tableNumber });
  res.status(201).json(call);
});

callsRouter.patch("/calls/:id", requireStaffOrAdmin, async (req, res) => {
  const status = (req.body as { status?: StaffCallStatus } | undefined)?.status;
  if (status !== "pending" && status !== "done") {
    res.status(400).json({ error: "ສະຖານະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const current = publicCall(await StaffCallModel.findOne({ id: String(req.params.id ?? "") }).lean());
  if (!current) {
    res.status(404).json({ error: "ບໍ່ພົບຄຳຮ້ອງຂໍ." });
    return;
  }

  if (status === "done") {
    await StaffCallModel.updateMany(
      { tableNumber: current.tableNumber, reason: current.reason, status: "pending" },
      { $set: { status: "done", updatedAt: new Date().toISOString() } },
    );
  } else {
    await StaffCallModel.updateOne({ id: current.id }, { $set: { status, updatedAt: new Date().toISOString() } });
  }

  const updated = publicCall(await StaffCallModel.findOne({ id: current.id }).lean());
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບຄຳຮ້ອງຂໍ." });
    return;
  }

  broadcastCalls({ type: "updated", callId: updated.id, tableNumber: updated.tableNumber });
  res.json(updated);
});
