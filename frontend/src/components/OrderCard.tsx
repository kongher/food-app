import { useState } from "react";
import { displayOrderCode } from "../lib/orderCode";
import { formatTime, formatVnd } from "../lib/format";
import { printOrderBill } from "../lib/printBill";
import type { Order, Shop } from "../types";

interface Props {
  order: Order;
  shop: Shop;
  onComplete?: (id: string) => void;
}

export function OrderCard({ order, shop, onComplete }: Props) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const code = displayOrderCode(order);
  const completed = order.status === "completed";

  async function printBill() {
    setPrinting(true);
    setPrintError("");
    try {
      await printOrderBill(order, shop);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "ພິມບິນບໍ່ສຳເລັດ.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <article
      className={`rounded-3xl bg-white p-5 shadow-sm ${order.status === "pending" ? "ring-2 ring-orange-300" : "opacity-95"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold tracking-wide text-orange-700">{code}</p>
          <p className="font-display text-2xl text-stone-900">ໂຕະ {order.tableNumber}</p>
          <p className="text-sm text-stone-500">{formatTime(order.createdAt)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            completed ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
          }`}
        >
          {completed ? "ສຳເລັດ" : "ລໍຖ້າ"}
        </span>
      </div>
      <ul className="mt-4 space-y-2">
        {order.items.map((item, index) => (
          <li key={`${order.id}-${index}`} className="flex justify-between text-sm">
            <span>
              {item.quantity}× {item.name}
              {item.note ? <em className="ml-2 text-orange-700">({item.note})</em> : null}
            </span>
            <span>{formatVnd(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {printError && <p className="mt-3 text-sm text-red-600">{printError}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
        <p className="font-semibold">ລວມ: {formatVnd(order.total)}</p>
        <div className="flex flex-wrap gap-2">
          {completed && (
            <button
              type="button"
              disabled={printing}
              onClick={() => void printBill()}
              className="rounded-2xl bg-stone-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {printing ? "ກຳລັງພິມ..." : "ພິມໃບບິນ"}
            </button>
          )}
          {order.status === "pending" && onComplete && (
            <button
              type="button"
              onClick={() => onComplete(order.id)}
              className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white"
            >
              ສຳເລັດ
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
