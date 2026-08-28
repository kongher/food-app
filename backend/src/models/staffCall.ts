import mongoose, { Schema } from "mongoose";
import type { StaffCall } from "../types.js";

const staffCallSchema = new Schema<StaffCall>(
  {
    id: { type: String, required: true, unique: true },
    tableNumber: { type: Number, required: true, min: 1 },
    reason: { type: String, enum: ["payment", "refill", "other"], required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["pending", "done"], default: "pending", index: true },
    times: { type: Number, required: true, min: 1, default: 1 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false, collection: "staffCalls" },
);

staffCallSchema.index({ updatedAt: -1 });
staffCallSchema.index(
  { tableNumber: 1, reason: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "pending_table_reason" },
);

export const StaffCallModel = mongoose.model<StaffCall>("StaffCall", staffCallSchema);

function callTimes(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
}

export async function mergeDuplicatePendingCalls(): Promise<void> {
  const pending = await StaffCallModel.find({ status: "pending" }).lean();
  const groups = new Map<string, typeof pending>();

  for (const call of pending) {
    const key = `${call.tableNumber}:${call.reason}`;
    const list = groups.get(key) ?? [];
    list.push(call);
    groups.set(key, list);
  }

  for (const list of groups.values()) {
    if (list.length === 0) continue;

    list.sort((a, b) => {
      const aAt = a.updatedAt || a.createdAt;
      const bAt = b.updatedAt || b.createdAt;
      return new Date(bAt).getTime() - new Date(aAt).getTime();
    });

    const keep = list[0];
    const times = list.reduce((sum, call) => sum + callTimes(call.times), 0);
    const latest = list.reduce((max, call) => {
      const at = call.updatedAt || call.createdAt;
      return at > max ? at : max;
    }, keep.updatedAt || keep.createdAt);

    await StaffCallModel.updateOne(
      { id: keep.id },
      { $set: { times, updatedAt: latest, createdAt: keep.createdAt || latest } },
    );

    const extraIds = list.slice(1).map((call) => call.id);
    if (extraIds.length > 0) {
      await StaffCallModel.deleteMany({ id: { $in: extraIds } });
    }
  }

  await StaffCallModel.updateMany(
    { $or: [{ times: { $exists: false } }, { times: null }, { times: { $lt: 1 } }] },
    { $set: { times: 1 } },
  );

  const missingUpdated = await StaffCallModel.find({
    $or: [{ updatedAt: { $exists: false } }, { updatedAt: null }, { updatedAt: "" }],
  }).lean();
  for (const call of missingUpdated) {
    await StaffCallModel.updateOne({ id: call.id }, { $set: { updatedAt: call.createdAt } });
  }
}
