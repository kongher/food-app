import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { addSseClient, broadcastOrders, broadcastTables, removeSseClient } from "../events.js";
import { getRequestAuth, requireAdmin, requireStaffOrAdmin } from "../lib/auth.js";
import { toPublic, toPublicList } from "../lib/serialize.js";
import { OrderModel, ProductModel, TableModel } from "../models/index.js";
import { uniqueOrderCode, withOrderCode } from "../models/order.js";
import { guestAccessError, openTableSession } from "../models/table.js";
import type { Order, OrderItem, OrderStatus, Product } from "../types.js";

const orderLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "ທ່ານສັ່ງອາຫານໄວເກີນໄປ, ກະລຸນາລອງໃໝ່ພາຍຫຼັງ." },
});

export const ordersRouter = Router();

ordersRouter.get("/orders/stream", requireAdmin, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write("event: ping\ndata: ok\n\n");

  addSseClient(res);
  const heartbeat = setInterval(() => {
    res.write("event: ping\ndata: ok\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(res);
  });
});

ordersRouter.get("/orders", requireStaffOrAdmin, async (_req, res) => {
  const orders = await OrderModel.find().sort({ createdAt: -1 }).lean();
  res.json(toPublicList<Order>(orders).map(withOrderCode));
});

ordersRouter.post("/orders", orderLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tableNumber = Number(body.tableNumber);

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const table = await TableModel.findOne({ number: tableNumber }).lean();
  const staff = getRequestAuth(req);
  if (!staff) {
    const blocked = guestAccessError(table);
    if (blocked) {
      res.status(403).json({ error: blocked });
      return;
    }
  } else if (!table) {
    res.status(400).json({ error: "ບໍ່ພົບໂຕະນີ້." });
    return;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: "ອໍເດີຕ້ອງມີຢ່າງໜ້ອຍ 1 ລາຍການ." });
    return;
  }

  const items: OrderItem[] = [];
  const productIds = body.items.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return typeof row.productId === "string" ? row.productId : "";
  });
  const products = toPublicList<Product>(
    await ProductModel.find({ id: { $in: productIds.filter(Boolean) } }).lean(),
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  for (const raw of body.items) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const productId = typeof row.productId === "string" ? row.productId : "";
    const quantity = Number(row.quantity);
    const note = typeof row.note === "string" ? row.note.trim() : "";

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      res.status(400).json({ error: "ລາຍການອາຫານບໍ່ຖືກຕ້ອງ." });
      return;
    }

    const product = byId.get(productId);
    if (!product) {
      res.status(400).json({ error: "ມີລາຍການທີ່ບໍ່ຢູ່ໃນເມນູແລ້ວ." });
      return;
    }
    if (!product.available) {
      res.status(400).json({ error: `ເມນູ "${product.name}" ໝົດແລ້ວ.` });
      return;
    }

    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      note,
    });
  }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const createdAt = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    code: await uniqueOrderCode(new Date(createdAt)),
    tableNumber,
    items,
    total,
    status: "pending",
    createdAt,
  };

  await OrderModel.create(order);
  if (staff) {
    await openTableSession(order.tableNumber, order.createdAt);
    broadcastTables({ type: "updated", tableNumber: order.tableNumber });
  }
  broadcastOrders({ type: "created", orderId: order.id, tableNumber: order.tableNumber });
  res.status(201).json(withOrderCode(order));
});

function itemNote(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sameLine(a: Pick<OrderItem, "productId" | "note">, b: Pick<OrderItem, "productId" | "note">): boolean {
  return a.productId === b.productId && (a.note || "") === (b.note || "");
}

async function resolveOrderItems(
  rawItems: unknown,
  previous: OrderItem[],
): Promise<{ error: string } | { items: OrderItem[] }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "ອໍເດີຕ້ອງມີຢ່າງໜ້ອຍ 1 ລາຍການ." };
  }

  const productIds = rawItems.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return typeof row.productId === "string" ? row.productId : "";
  });
  const products = toPublicList<Product>(
    await ProductModel.find({ id: { $in: productIds.filter(Boolean) } }).lean(),
  );
  const byId = new Map(products.map((product) => [product.id, product]));
  const remaining = [...previous];
  const items: OrderItem[] = [];

  for (const raw of rawItems) {
    const row = (raw ?? {}) as Record<string, unknown>;
    const productId = typeof row.productId === "string" ? row.productId : "";
    const quantity = Number(row.quantity);
    const note = itemNote(row.note);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
      return { error: "ລາຍການອາຫານບໍ່ຖືກຕ້ອງ." };
    }

    const previousIndex = remaining.findIndex((item) => sameLine(item, { productId, note }));
    if (previousIndex >= 0) {
      const previousLine = remaining[previousIndex];
      remaining.splice(previousIndex, 1);
      if (previousLine) items.push({ ...previousLine, quantity, note });
      continue;
    }

    const product = byId.get(productId);
    if (!product) {
      return { error: "ມີລາຍການທີ່ບໍ່ຢູ່ໃນເມນູແລ້ວ." };
    }
    if (!product.available) {
      return { error: `ເມນູ "${product.name}" ໝົດແລ້ວ.` };
    }

    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      note,
    });
  }

  return { items };
}

function orderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

ordersRouter.put("/orders/:id/items", requireStaffOrAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = toPublic<Order>(await OrderModel.findOne({ id }).lean());
  if (!existing) {
    res.status(404).json({ error: "ບໍ່ພົບອໍເດີ." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const resolved = await resolveOrderItems(body.items, existing.items);
  if ("error" in resolved) {
    res.status(400).json({ error: resolved.error });
    return;
  }

  const updated = toPublic<Order>(
    await OrderModel.findOneAndUpdate(
      { id },
      { $set: { items: resolved.items, total: orderTotal(resolved.items) } },
      { returnDocument: "after" },
    ).lean(),
  );
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບອໍເດີ." });
    return;
  }

  broadcastOrders({ type: "updated", orderId: updated.id, tableNumber: updated.tableNumber });
  res.json(withOrderCode(updated));
});

ordersRouter.patch("/orders/:id", requireStaffOrAdmin, async (req, res) => {
  const status = (req.body as { status?: OrderStatus } | undefined)?.status;
  if (status !== "pending" && status !== "completed") {
    res.status(400).json({ error: "ສະຖານະອໍເດີບໍ່ຖືກຕ້ອງ." });
    return;
  }

  const updated = toPublic<Order>(
    await OrderModel.findOneAndUpdate(
      { id: String(req.params.id ?? "") },
      { $set: { status } },
      { returnDocument: "after" },
    ).lean(),
  );

  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບອໍເດີ." });
    return;
  }

  broadcastOrders({ type: "updated", orderId: updated.id });
  res.json(withOrderCode(updated));
});

ordersRouter.delete("/orders/:id", requireStaffOrAdmin, async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = toPublic<Order>(await OrderModel.findOneAndDelete({ id }).lean());
  if (!existing) {
    res.status(404).json({ error: "ບໍ່ພົບອໍເດີ." });
    return;
  }

  broadcastOrders({ type: "deleted", orderId: existing.id, tableNumber: existing.tableNumber });
  res.status(204).end();
});
