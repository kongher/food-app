import { useMemo, useState } from "react";
import { api } from "../api";
import { formatVnd } from "../lib/format";
import { printTableBill } from "../lib/printBill";
import { billTotal, mergeOrderItems, orderLineKey } from "../lib/tableBill";
import type { Category, Order, OrderItem, Product, Shop } from "../types";
import { AddOrderItemDialog } from "./OrderCard";

export function TableSessionBill({
  tableNumber,
  occupiedAt,
  orders,
  products,
  categories,
  shop,
  onUpdated,
  onRemoved,
}: {
  tableNumber: number;
  occupiedAt: string | null;
  orders: Order[];
  products: Product[];
  categories: Category[];
  shop: Shop;
  onUpdated?: (order: Order) => void;
  onRemoved?: (id: string) => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const items = useMemo(() => mergeOrderItems(orders), [orders]);
  const total = billTotal(items);
  const startedAt = occupiedAt || orders[0]?.createdAt || new Date().toISOString();
  const newest = orders[orders.length - 1];
  const canEdit = Boolean(onUpdated);

  async function printBill() {
    setPrinting(true);
    setError("");
    try {
      await printTableBill({
        shop,
        tableNumber,
        items,
        total,
        startedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ພິມບິນບໍ່ສຳເລັດ.");
    } finally {
      setPrinting(false);
    }
  }

  async function addProduct(product: Product, quantity: number) {
    setUpdating(true);
    setError("");
    try {
      if (!newest) {
        const created = await api.createOrder({
          tableNumber,
          items: [{ productId: product.id, quantity }],
        });
        onUpdated?.(created);
      } else {
        const next = newest.items.map((item) => ({ ...item }));
        const existing = next.find((item) => item.productId === product.id && !(item.note || ""));
        if (existing) existing.quantity = Math.min(999, existing.quantity + quantity);
        else {
          next.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity,
            note: "",
          });
        }
        onUpdated?.(await api.updateOrderItems(newest.id, next));
      }
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເພີ່ມເມນູບໍ່ສຳເລັດ.");
    } finally {
      setUpdating(false);
    }
  }

  async function changeQuantity(line: OrderItem, quantity: number) {
    if (updating || !onUpdated) return;
    const current = items.find((item) => orderLineKey(item) === orderLineKey(line))?.quantity ?? 0;
    const delta = quantity - current;
    if (delta === 0) return;
    if (quantity < 1 && items.length <= 1) {
      setError("ອໍເດີຕ້ອງມີຢ່າງນ້ອຍ 1 ລາຍການ.");
      return;
    }
    setUpdating(true);
    setError("");
    try {
      if (delta > 0) {
        await applyIncrease(line, delta);
      } else {
        await applyDecrease(line, -delta);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ອັບເດດອໍເດີບໍ່ສຳເລັດ.");
    } finally {
      setUpdating(false);
    }
  }

  async function applyIncrease(line: OrderItem, delta: number) {
    const newestFirst = [...orders].reverse();
    const target =
      newestFirst.find((order) => order.items.some((item) => orderLineKey(item) === orderLineKey(line))) ??
      newestFirst[0];
    if (!target) {
      const created = await api.createOrder({
        tableNumber,
        items: [{ productId: line.productId, quantity: delta, note: line.note }],
      });
      onUpdated?.(created);
      return;
    }
    const next = target.items.map((item) => ({ ...item }));
    const existing = next.find((item) => orderLineKey(item) === orderLineKey(line));
    if (existing) existing.quantity = Math.min(999, existing.quantity + delta);
    else next.push({ ...line, quantity: delta });
    onUpdated?.(await api.updateOrderItems(target.id, next));
  }

  async function applyDecrease(line: OrderItem, amount: number) {
    let remaining = amount;
    const newestFirst = [...orders].reverse();
    for (const order of newestFirst) {
      if (remaining <= 0) break;
      const index = order.items.findIndex((item) => orderLineKey(item) === orderLineKey(line));
      if (index < 0) continue;
      const current = order.items[index];
      if (!current) continue;
      const take = Math.min(current.quantity, remaining);
      remaining -= take;
      const next = order.items
        .map((item, itemIndex) =>
          itemIndex === index ? { ...item, quantity: item.quantity - take } : { ...item },
        )
        .filter((item) => item.quantity > 0);
      if (next.length === 0) {
        await api.deleteOrder(order.id);
        onRemoved?.(order.id);
      } else {
        onUpdated?.(await api.updateOrderItems(order.id, next));
      }
    }
  }

  return (
    <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-orange-200">
      <p className="text-sm font-semibold text-stone-700">ບິນໂຕະນີ້</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={orderLineKey(item)} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void changeQuantity(item, item.quantity - 1)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg font-semibold text-stone-800 disabled:opacity-40"
                    aria-label="ຫຼຸດຈຳນວນ"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => void changeQuantity(item, item.quantity + 1)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg font-semibold text-orange-800 disabled:opacity-40"
                    aria-label="ເພີ່ມຈຳນວນ"
                  >
                    +
                  </button>
                  <span className="min-w-0">
                    {item.name}
                    {item.note ? <em className="ml-2 text-orange-700">({item.note})</em> : null}
                  </span>
                </div>
              ) : (
                <span>
                  {item.quantity}× {item.name}
                  {item.note ? <em className="ml-2 text-orange-700">({item.note})</em> : null}
                </span>
              )}
            </div>
            <span className="shrink-0">{formatVnd(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <button
          type="button"
          disabled={updating || products.length === 0}
          onClick={() => {
            setError("");
            setAdding(true);
          }}
          className="mt-3 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 disabled:opacity-40"
        >
          + ເພີ່ມເມນູ
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4">
        <p className="font-semibold">ລວມ: {formatVnd(total)}</p>
        <button
          type="button"
          disabled={printing || updating || items.length === 0}
          onClick={() => void printBill()}
          className="rounded-2xl bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {printing ? "ກຳລັງພິມ..." : "ພິມໃບບິນ"}
        </button>
      </div>
      {adding && (
        <AddOrderItemDialog
          products={products}
          categories={categories}
          onAdd={(product, quantity) => void addProduct(product, quantity)}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
