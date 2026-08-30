import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { broadcastSongs } from "../events.js";
import { getRequestAuth, requireStaffOrAdmin } from "../lib/auth.js";
import { toPublic, toPublicList } from "../lib/serialize.js";
import { SongRequestModel, TableModel } from "../models/index.js";
import { guestAccessError } from "../models/table.js";
import type { SongRequest, SongRequestStatus } from "../types.js";

const TITLE_MAX = 200;

const songLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ທ່ານສົ່ງຄຳຮ້ອງເພງໄວເກີນໄປ, ກະລຸນາລອງໃໝ່ພາຍຫຼັງ." },
});

export const songsRouter = Router();

function normalizeTitle(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX);
}

function isSongStatus(value: unknown): value is SongRequestStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function sortSongs(songs: SongRequest[]): SongRequest[] {
  const rank: Record<SongRequestStatus, number> = { pending: 0, approved: 1, rejected: 2 };
  return [...songs].sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

songsRouter.get("/songs", async (req, res) => {
  const auth = getRequestAuth(req);
  const tableNumber = Number(req.query.tableNumber);

  if (!auth) {
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
      return;
    }
    const songs = toPublicList<SongRequest>(
      await SongRequestModel.find({ tableNumber }).sort({ createdAt: -1 }).lean(),
    );
    res.json(songs);
    return;
  }

  const filter = Number.isInteger(tableNumber) && tableNumber > 0 ? { tableNumber } : {};
  const songs = toPublicList<SongRequest>(await SongRequestModel.find(filter).lean());
  res.json(sortSongs(songs));
});

songsRouter.post("/songs", songLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tableNumber = Number(body.tableNumber);
  const title = normalizeTitle(body.title);

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }
  if (!title) {
    res.status(400).json({ error: "ກະລຸນາໃສ່ຊື່ເພງ, ລິງກ໌ YouTube ຫຼື ຊື່ນັກຮ້ອງ." });
    return;
  }

  const table = await TableModel.findOne({ number: tableNumber }).lean();
  if (!getRequestAuth(req)) {
    const blocked = guestAccessError(table);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
  } else if (!table) {
    res.status(400).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  const now = new Date().toISOString();
  const song: SongRequest = {
    id: randomUUID(),
    tableNumber,
    title,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await SongRequestModel.create(song);
  broadcastSongs({ type: "created", songId: song.id, tableNumber });
  res.status(201).json(song);
});

songsRouter.patch("/songs/:id", requireStaffOrAdmin, async (req, res) => {
  const status = (req.body as { status?: unknown } | undefined)?.status;
  if (!isSongStatus(status)) {
    res.status(400).json({ error: "ສະຖານະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const current = toPublic<SongRequest>(
    await SongRequestModel.findOne({ id: String(req.params.id ?? "") }).lean(),
  );
  if (!current) {
    res.status(404).json({ error: "ບໍ່ພົບຄຳຮ້ອງເພງ." });
    return;
  }

  const updated = toPublic<SongRequest>(
    await SongRequestModel.findOneAndUpdate(
      { id: current.id },
      { $set: { status, updatedAt: new Date().toISOString() } },
      { returnDocument: "after" },
    ).lean(),
  );
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບຄຳຮ້ອງເພງ." });
    return;
  }

  broadcastSongs({ type: "updated", songId: updated.id, tableNumber: updated.tableNumber });
  res.json(updated);
});

songsRouter.delete("/songs/:id", requireStaffOrAdmin, async (req, res) => {
  const current = toPublic<SongRequest>(
    await SongRequestModel.findOne({ id: String(req.params.id ?? "") }).lean(),
  );
  if (!current) {
    res.status(404).json({ error: "ບໍ່ພົບຄຳຮ້ອງເພງ." });
    return;
  }

  await SongRequestModel.deleteOne({ id: current.id });
  broadcastSongs({ type: "deleted", songId: current.id, tableNumber: current.tableNumber });
  res.status(204).end();
});
