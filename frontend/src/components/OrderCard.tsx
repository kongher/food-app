import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import { displayOrderCode } from "../lib/orderCode";
import { formatTime, formatVnd, onImgError } from "../lib/format";
import { PAYMENT_METHOD_LABEL } from "../lib/payment";
import { printOrderBill } from "../lib/printBill";
import type { Category, Order, OrderItem, Product, Shop } from "../types";

interface Props {
  order: Order;
  shop: Shop;
  products?: Product[];
  categories?: Category[];
  editable?: boolean;
  compact?: boolean;
  onComplete?: (id: string) => void;
  onUpdated?: (order: Order) => void;
}

export function OrderCard({
  order,
  shop,
  products = [],
  categories = [],
  editable = false,
  compact = false,
  onComplete,
  onUpdated,
}: Props) {
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");
  const [adding, setAdding] = useState(false);
  const code = displayOrderCode(order);
  const completed = order.status === "completed";
  const canEdit = editable && Boolean(onUpdated);

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

  async function saveItems(items: OrderItem[]) {
    if (items.length === 0) {
      setEditError("ອໍເດີຕ້ອງມີຢ່າງນ້ອຍ 1 ລາຍການ.");
      return;
    }
    setUpdating(true);
    setEditError("");
    try {
      const updated = await api.updateOrderItems(
        order.id,
        items.map((item) => ({ productId: item.productId, quantity: item.quantity, note: item.note })),
      );
      onUpdated?.(updated);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "ອັບເດດອໍເດີບໍ່ສຳເລັດ.");
    } finally {
      setUpdating(false);
    }
  }

  function changeQuantity(index: number, quantity: number) {
    if (updating) return;
    const next = order.items.map((item) => ({ ...item }));
    const current = next[index];
    if (!current) return;
    if (quantity < 1) {
      if (next.length <= 1) {
        setEditError("ອໍເດີຕ້ອງມີຢ່າງນ້ອຍ 1 ລາຍການ.");
        return;
      }
      next.splice(index, 1);
    } else {
      current.quantity = Math.min(999, quantity);
    }
    void saveItems(next);
  }

  function addProduct(product: Product, quantity: number) {
    const next = order.items.map((item) => ({ ...item }));
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
    setAdding(false);
    void saveItems(next);
  }

  return (
    <article
      className={`rounded-3xl bg-white shadow-sm ${compact ? "p-4" : "p-5"} ${
        order.status === "pending" ? "ring-2 ring-orange-300" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold tracking-wide text-orange-700">{code}</p>
          <p className="font-display text-2xl text-stone-900">ໂຕະ {order.tableNumber}</p>
          <p className="text-sm text-stone-500">{formatTime(order.createdAt)}</p>
          {completed && order.paymentMethod && (
            <p
              className={`mt-1 text-xs font-semibold ${
                order.paymentMethod === "cash" ? "text-emerald-700" : "text-sky-700"
              }`}
            >
              {PAYMENT_METHOD_LABEL[order.paymentMethod]}
            </p>
          )}
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
          <li key={`${order.id}-${item.productId}-${index}`} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => changeQuantity(index, item.quantity - 1)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg font-semibold text-stone-800 disabled:opacity-40"
                    aria-label="ຫຼຸດຈຳນວນ"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => changeQuantity(index, item.quantity + 1)}
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
            setEditError("");
            setAdding(true);
          }}
          className="mt-3 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 disabled:opacity-40"
        >
          + ເພີ່ມເມນູ
        </button>
      )}
      {(printError || editError) && (
        <p className="mt-3 text-sm text-red-600">{printError || editError}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
        <p className="font-semibold">ລວມ: {formatVnd(order.total)}</p>
        <div className="flex flex-wrap gap-2">
          {completed && (
            <button
              type="button"
              disabled={printing || updating}
              onClick={() => void printBill()}
              className="rounded-2xl bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {printing ? "ກຳລັງພິມ..." : "ພິມໃບບິນ"}
            </button>
          )}
          {order.status === "pending" && onComplete && (
            <button
              type="button"
              disabled={updating}
              onClick={() => onComplete(order.id)}
              className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              ສຳເລັດ
            </button>
          )}
        </div>
      </div>
      {adding && (
        <AddOrderItemDialog
          products={products}
          categories={categories}
          onAdd={addProduct}
          onClose={() => setAdding(false)}
        />
      )}
    </article>
  );
}

export function AddOrderItemDialog({
  products,
  categories = [],
  onAdd,
  onClose,
}: {
  products: Product[];
  categories?: Category[];
  onAdd: (product: Product, quantity: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const visibleCategories = useMemo(() => {
    const used = new Set(
      products.filter((product) => product.available).map((product) => product.categoryId),
    );
    return categories.filter((category) => used.has(category.id));
  }, [categories, products]);
  const available = useMemo(
    () =>
      products.filter((product) => {
        if (!product.available) return false;
        if (activeCategory !== "all" && product.categoryId !== activeCategory) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return `${product.name} ${product.description}`.toLowerCase().includes(q);
      }),
    [products, query, activeCategory],
  );
  const selected = available.find((product) => product.id === selectedId) ?? available[0];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-stone-900">ເພີ່ມເມນູ</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
            ປິດ
          </button>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ຄົ້ນຫາເມນູ..."
          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
        />
        {visibleCategories.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                activeCategory === "all" ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-600"
              }`}
            >
              ທັງໝົດ
            </button>
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
                  activeCategory === category.id ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
        <label className="mt-3 flex items-center gap-3 text-sm font-medium text-stone-700">
          ຈຳນວນ
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-lg"
            >
              −
            </button>
            <span className="w-6 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(999, value + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-lg text-orange-800"
            >
              +
            </button>
          </span>
        </label>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {available.length === 0 && <li className="py-6 text-center text-sm text-stone-500">ບໍ່ພົບເມນູ.</li>}
          {available.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => setSelectedId(product.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ${
                  selected?.id === product.id ? "bg-orange-50 ring-2 ring-orange-400" : "bg-stone-50"
                }`}
              >
                <img
                  src={product.image}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover"
                  onError={onImgError}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-stone-900">{product.name}</span>
                  <span className="text-sm text-orange-700">{formatVnd(product.price)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={!selected}
          onClick={() => {
            if (!selected) return;
            onAdd(selected, quantity);
          }}
          className="mt-4 w-full shrink-0 rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          ເພີ່ມເຂົ້າອໍເດີ
        </button>
      </div>
    </div>,
    document.body,
  );
}
