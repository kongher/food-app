import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { addSseClient, broadcastOrders, removeSseClient } from "../events.js";
import { requireAdmin } from "../lib/auth.js";
import { toPublic, toPublicList } from "../lib/serialize.js";
import { OrderModel, ProductModel } from "../models/index.js";
import { markTableOccupied } from "../models/table.js";
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

ordersRouter.get("/orders", requireAdmin, async (_req, res) => {
  const orders = await OrderModel.find().sort({ createdAt: -1 }).lean();
  res.json(toPublicList<Order>(orders));
});

ordersRouter.post("/orders", orderLimiter, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tableNumber = Number(body.tableNumber);

  if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
    res.status(400).json({ error: "ເລກໂຕະບໍ່ຖືກຕ້ອງ." });
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
  const order: Order = {
    id: randomUUID(),
    tableNumber,
    items,
    total,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await OrderModel.create(order);
  await markTableOccupied(order.tableNumber);
  broadcastOrders({ type: "created", orderId: order.id, tableNumber: order.tableNumber });
  res.status(201).json(order);
});

ordersRouter.patch("/orders/:id", requireAdmin, async (req, res) => {
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
  res.json(updated);
});
