import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ShopWelcome } from "../components/ShopWelcome";
import { useCart } from "../context/CartContext";
import { formatVnd, onImgError } from "../lib/format";
import { getSavedTableNumber, isValidTableNumber, saveTableNumber } from "../lib/tableSession";
import type { Category, Product, StaffCallReason } from "../types";

const NOTE_PRESETS = [
  "ບໍ່ໃສ່ຜັກບົ່ວ",
  "ເພີ່ມເຜັດ",
  "ນ້ຳກ້ອນໜ້ອຍ",
  "ບໍ່ໃສ່ນ້ຳຕານ",
  "ຫວານໜ້ອຍ",
  "ບໍ່ໃສ່ໝາກເຜັດ",
];

const CALL_REASONS: { id: "payment" | "refill" | "other"; label: string }[] = [
  { id: "payment", label: "ຈ່າຍເງິນ" },
  { id: "refill", label: "ເພີ່ມນ້ຳລົ້າ/ນ້ຳກ້ອນ" },
  { id: "other", label: "ຕ້ອງການຄວາມຊ່ວຍເຫຼືອອື່ນ" },
];

function matchesQuery(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${product.name} ${product.description}`.toLowerCase().includes(q);
}

interface Props {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: string;
  variant?: "customer" | "staff";
}

export function CustomerMenu({
  products,
  categories: categoryList,
  loading,
  error,
  variant = "customer",
}: Props) {
  const isStaff = variant === "staff";
  const [params, setSearchParams] = useSearchParams();
  const tableFromUrl = Number(params.get("table"));
  const [staffTable, setStaffTable] = useState("");
  const tableNumber = isStaff
    ? Number(staffTable)
    : isValidTableNumber(tableFromUrl)
      ? tableFromUrl
      : (getSavedTableNumber() ?? NaN);
  const hasTable = isValidTableNumber(tableNumber);

  useEffect(() => {
    if (isStaff) return;
    if (isValidTableNumber(tableFromUrl)) {
      saveTableNumber(tableFromUrl);
      return;
    }
    const saved = getSavedTableNumber();
    if (saved) {
      setSearchParams({ table: String(saved) }, { replace: true });
    }
  }, [isStaff, tableFromUrl, setSearchParams]);

  const [manualTable, setManualTable] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [draftProduct, setDraftProduct] = useState<Product | null>(null);
  const [draftQty, setDraftQty] = useState(1);
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [draftCustom, setDraftCustom] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [orderError, setOrderError] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  const [callReason, setCallReason] = useState<StaffCallReason>("payment");
  const [callSending, setCallSending] = useState(false);
  const [callNotice, setCallNotice] = useState("");
  const [callError, setCallError] = useState("");

  const { items, count, total, addItem, setQuantity, removeItem, clear } = useCart();

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 2000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products) {
      const list = map.get(product.categoryId) ?? [];
      list.push(product);
      map.set(product.categoryId, list);
    }
    return map;
  }, [products]);

  const categories = useMemo(
    () => categoryList.filter((category) => (grouped.get(category.id) ?? []).length > 0),
    [categoryList, grouped],
  );

  function categoryName(id: string): string {
    return categoryList.find((category) => category.id === id)?.name ?? "ອື່ນໆ";
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!matchesQuery(product, query)) return false;
      if (activeCategory !== "all" && product.categoryId !== activeCategory) return false;
      return true;
    });
  }, [products, query, activeCategory]);

  const filteredGrouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of filteredProducts) {
      const list = map.get(product.categoryId) ?? [];
      list.push(product);
      map.set(product.categoryId, list);
    }
    return map;
  }, [filteredProducts]);

  function openDraft(product: Product) {
    setDraftProduct(product);
    setDraftQty(1);
    setDraftNotes([]);
    setDraftCustom("");
  }

  function toggleNote(label: string) {
    setDraftNotes((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  }

  function confirmDraft() {
    if (!draftProduct) return;
    const note = [...draftNotes, draftCustom.trim()].filter(Boolean).join(", ");
    addItem(draftProduct, draftQty, note);
    setDraftProduct(null);
  }

  async function placeOrder(tableNumber: number) {
    if (items.length === 0) return;
    setSubmitting(true);
    setOrderError("");
    try {
      await api.createOrder({
        tableNumber,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          note: item.note,
        })),
      });
      clear();
      setCartOpen(false);
      setSuccess(`ສັ່ງອາຫານສຳເລັດ! ເຮືອນຄົວກຳລັງກະກຽມໃຫ້ໂຕະ ${tableNumber}.`);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : "ບໍ່ສາມາດສັ່ງອາຫານໄດ້.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendStaffCall() {
    setCallSending(true);
    setCallError("");
    try {
      await api.createCall({ tableNumber, reason: callReason });
      setCallOpen(false);
      setCallNotice("ສົ່ງຄຳຮ້ອງຂໍແລ້ວ. ພະນັກງານກຳລັງມາໂຕະທ່ານ.");
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "ສົ່ງຄຳຮ້ອງຂໍບໍ່ສຳເລັດ.");
    } finally {
      setCallSending(false);
    }
  }

  if (!hasTable && !isStaff) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
        <ShopWelcome />
        <h1 className="font-display mt-2 text-4xl text-stone-900">ທ່ານນັ່ງໂຕະໃດ?</h1>
        <p className="mt-3 text-stone-600">
          ສະແກນລະຫັດ QR ເທິງໂຕະເພື່ອເຂົ້າເບິ່ງເມນູ ຫຼື ປ້ອນເລກໂຕະຂ້າງລຸ່ມ.
        </p>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(manualTable);
            if (isValidTableNumber(n)) {
              saveTableNumber(n);
              setSearchParams({ table: String(n) });
            }
          }}
        >
          <input
            type="number"
            min={1}
            value={manualTable}
            onChange={(e) => setManualTable(e.target.value)}
            placeholder="ຕົວຢ່າງ: 3"
            className="flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-orange-500"
          />
          <button className="rounded-2xl bg-orange-600 px-5 py-3 font-semibold text-white" type="submit">
            ເຂົ້າເມນູ
          </button>
        </form>
        <Link to="/admin/login" className="mt-8 text-center text-sm text-stone-400 underline">
          ສຳລັບຮ້ານ · ໜ້າຈັດການ
        </Link>
        <Link to="/staff/login" className="mt-2 text-center text-sm text-stone-400 underline">
          ພະນັກງານ
        </Link>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-lg bg-[#fff7ed] pb-28 ${isStaff ? "" : "min-h-dvh"}`}>
      <header className={`${isStaff ? "relative" : "sticky top-0 z-20"} border-b border-orange-100 bg-[#fff7ed]/95 px-4 py-3 backdrop-blur`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isStaff ? (
              <label className="block text-sm font-medium text-stone-700">
                ໂຕະລູກຄ້າ
                <input
                  type="number"
                  min={1}
                  value={staffTable}
                  onChange={(event) => setStaffTable(event.target.value)}
                  placeholder="ໃສ່ເລກໂຕະ"
                  className="mt-1 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-orange-500"
                />
              </label>
            ) : (
              <>
                <ShopWelcome />
                <h1 className="font-display mt-1 text-2xl text-stone-900">ໂຕະເລກ {tableNumber}</h1>
              </>
            )}
          </div>
          {!isStaff && (
            <Link
              to="/admin"
              className="mt-1 shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-500"
            >
              ຈັດການ
            </Link>
          )}
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">ຄົ້ນຫາອາຫານ</span>
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-stone-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ຄົ້ນຫາອາຫານ..."
            className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pr-4 pl-10 text-sm outline-none focus:border-orange-500"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <CategoryChip active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
            ທັງໝົດ
          </CategoryChip>
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </CategoryChip>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4">
        {loading && <p className="py-10 text-center text-stone-500">ກຳລັງໂຫຼດເມນູ...</p>}
        {error && <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}

        {filteredProducts.length === 0 && !loading
          ? (
              <p className="rounded-3xl bg-white p-8 text-center text-stone-500">
                ບໍ່ພົບອາຫານທີ່ຄົ້ນຫາ
              </p>
            )
          : [...filteredGrouped.entries()].map(([categoryId, list]) => (
              <section key={categoryId} className="mb-6">
                <h2 className="font-display mb-3 text-xl text-stone-800">{categoryName(categoryId)}</h2>
                <div className="space-y-3">
                  {list.map((product) => (
                    <ProductCard key={product.id} product={product} onOpen={() => openDraft(product)} />
                  ))}
                </div>
              </section>
            ))}
      </main>

      {count > 0 && !cartOpen && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed right-3 bottom-3 left-3 z-30 mx-auto flex max-w-lg items-center justify-between rounded-2xl bg-stone-900 px-5 py-3.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="flex items-center gap-3">
            <span className="relative inline-flex h-9 w-9 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-white"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2M1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 20.01 4H5.21l-.94-2zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2" />
              </svg>
              <span className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] leading-none font-bold text-white">
                {count}
              </span>
            </span>
            <span className="text-sm font-semibold">ກະຕ່າສິນຄ້າ</span>
          </span>
          <span className="font-display text-lg">{formatVnd(total)}</span>
        </button>
      )}

      {!isStaff && !cartOpen && !draftProduct && !callOpen && (
        <div
          className={`pointer-events-none fixed inset-x-0 z-30 mx-auto h-0 max-w-lg ${count > 0 ? "bottom-24" : "bottom-5"}`}
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            type="button"
            onClick={() => {
              setCallOpen(true);
              setCallError("");
            }}
            className="pointer-events-auto absolute right-3 bottom-0 flex items-center gap-2 rounded-full bg-orange-600 px-4 py-3 font-semibold text-white shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1z" />
            </svg>
            ເອີ້ນພະນັກງານ
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setCartOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-3xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200" />
            <h3 className="font-display text-2xl">ກະຕ່າ · ໂຕະ {hasTable ? tableNumber : "—"}</h3>
            <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
              {items.map((item) => (
                <div key={item.key} className="flex gap-3 rounded-2xl bg-orange-50 p-3">
                  <img src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" onError={onImgError} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{item.name}</p>
                    {item.note && <p className="text-xs text-orange-700">ໝາຍເຫດ: {item.note}</p>}
                    <p className="text-sm text-stone-500">{formatVnd(item.price)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="h-7 w-7 rounded-full bg-white"
                        onClick={() => setQuantity(item.key, item.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        className="h-7 w-7 rounded-full bg-white"
                        onClick={() => setQuantity(item.key, item.quantity + 1)}
                      >
                        +
                      </button>
                      <button className="ml-auto text-xs text-red-600" onClick={() => removeItem(item.key)}>
                        ລຶບ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {orderError && <p className="mt-3 text-sm text-red-600">{orderError}</p>}
            <div className="mt-4 flex items-center justify-between text-lg font-semibold">
              <span>ລວມທັງໝົດ</span>
              <span className="font-display text-orange-700">{formatVnd(total)}</span>
            </div>
            <button
              disabled={submitting || items.length === 0 || !hasTable}
              onClick={() => placeOrder(tableNumber)}
              className="mt-4 w-full rounded-2xl bg-orange-600 py-4 font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "ກຳລັງສົ່ງ..." : hasTable ? "ສັ່ງອາຫານດຽວນີ້" : "ກະລຸນາໃສ່ເລກໂຕະ"}
            </button>
          </div>
        </div>
      )}

      {draftProduct && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setDraftProduct(null)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-3xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img src={draftProduct.image} alt="" className="h-40 w-full rounded-2xl object-cover" onError={onImgError} />
              <button
                type="button"
                aria-label="ປິດ"
                onClick={() => setDraftProduct(null)}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-xl font-semibold leading-none text-white"
              >
                ×
              </button>
            </div>
            <h3 className="font-display mt-3 text-2xl">{draftProduct.name}</h3>
            <p className="text-sm text-stone-500">{draftProduct.description}</p>
            <p className="mt-1 font-semibold text-orange-700">{formatVnd(draftProduct.price)}</p>
            <p className="mt-4 text-sm font-medium text-stone-700">ໝາຍເຫດເຖິງເຮືອນຄົວ</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NOTE_PRESETS.map((label) => {
                const active = draftNotes.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleNote(label)}
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      active ? "bg-orange-600 text-white" : "bg-orange-50 text-stone-700"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={draftCustom}
              onChange={(e) => setDraftCustom(e.target.value)}
              placeholder="ຂຽນເພີ່ມ: ບໍ່ໃສ່ຜັກບົ່ວ, ເພີ່ມເຜັດ..."
              className="mt-3 w-full rounded-2xl border border-stone-200 p-3 text-sm outline-none focus:border-orange-500"
              rows={2}
            />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="h-10 w-10 rounded-full bg-orange-100 text-lg" onClick={() => setDraftQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="w-6 text-center text-lg font-semibold">{draftQty}</span>
                <button className="h-10 w-10 rounded-full bg-orange-100 text-lg" onClick={() => setDraftQty((q) => q + 1)}>
                  +
                </button>
              </div>
              <button onClick={confirmDraft} className="rounded-2xl bg-stone-900 px-5 py-3 font-semibold text-white">
                ເພີ່ມ · {formatVnd(draftProduct.price * draftQty)}
              </button>
            </div>
          </div>
        </div>
      )}

      {callOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setCallOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200" />
            <h3 className="font-display text-2xl">ເອີ້ນພະນັກງານ</h3>
            <p className="mt-1 text-sm text-stone-500">ໂຕະ {tableNumber} · ເລືອກເຫດຜົນ</p>
            <div className="mt-4 space-y-2">
              {CALL_REASONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCallReason(item.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-left font-medium ${
                    callReason === item.id ? "bg-orange-600 text-white" : "bg-orange-50 text-stone-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {callError && <p className="mt-3 text-sm text-red-600">{callError}</p>}
            <button
              type="button"
              disabled={callSending}
              onClick={() => void sendStaffCall()}
              className="mt-5 w-full rounded-2xl bg-stone-900 py-4 font-semibold text-white disabled:opacity-60"
            >
              {callSending ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳຮ້ອງຂໍ"}
            </button>
          </div>
        </div>
      )}

      {callNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="max-w-sm rounded-3xl bg-white p-6 text-center">
            <p className="text-4xl">🔔</p>
            <h3 className="font-display mt-3 text-2xl">ຮັບແລ້ວ</h3>
            <p className="mt-2 text-stone-600">{callNotice}</p>
            <button
              className="mt-5 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white"
              onClick={() => setCallNotice("")}
            >
              ປິດ
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="max-w-sm rounded-3xl bg-white p-6 text-center">
            <p className="text-4xl">✅</p>
            <h3 className="font-display mt-3 text-2xl">ສົ່ງເຖິງເຮືອນຄົວແລ້ວ</h3>
            <p className="mt-2 text-stone-600">{success}</p>
            <button
              className="mt-5 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white"
              onClick={() => setSuccess("")}
            >
              ສັ່ງເພີ່ມຕໍ່
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
        active ? "bg-orange-600 text-white" : "bg-white text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer gap-3 rounded-3xl bg-white p-3 shadow-sm"
    >
      <img src={product.image} alt={product.name} className="h-24 w-24 shrink-0 rounded-2xl object-cover" onError={onImgError} />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-stone-900">{product.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{product.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-display text-orange-700">{formatVnd(product.price)}</span>
          <span className="rounded-full bg-orange-600 px-3 py-1 text-sm font-semibold text-white">ເພີ່ມ</span>
        </div>
      </div>
    </article>
  );
}
