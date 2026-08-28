import { emitSocket } from "./lib/socket.js";
import type { Response } from "express";

type SseEvent =
  | { name: "orders"; data: { type: "created" | "updated"; orderId: string; tableNumber?: number } }
  | { name: "calls"; data: { type: "created" | "updated" | "repeated"; callId: string; tableNumber?: number } };

const clients = new Set<Response>();

export function addSseClient(res: Response): void {
  clients.add(res);
}

export function removeSseClient(res: Response): void {
  clients.delete(res);
}

function emit(event: SseEvent): void {
  const payload = `event: ${event.name}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
  emitSocket(event.name, event.data);
}

export function broadcastOrders(data: {
  type: "created" | "updated";
  orderId: string;
  tableNumber?: number;
}): void {
  emit({ name: "orders", data });
}

export function broadcastCalls(data: {
  type: "created" | "updated" | "repeated";
  callId: string;
  tableNumber?: number;
}): void {
  emit({ name: "calls", data });
}
