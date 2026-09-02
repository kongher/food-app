import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { api } from "../api";
import { formatClock, formatElapsed } from "../lib/format";
import { billTotal, mergeOrderItems, sessionOrdersForTable } from "../lib/tableBill";
import { menuUrlForTable } from "../lib/tableSession";
import type { Category, DiningTable, Order, PaymentMethod, Product, Shop, TableAction, TableActionOptions } from "../types";
import { CloseTablePaymentModal } from "./CloseTablePaymentModal";
import { AddOrderItemDialog } from "./OrderCard";
import { TableSessionBill } from "./TableSessionBill";

interface BoardProps {
  tables: DiningTable[];
  canAdd?: boolean;
  adding?: boolean;
  orders?: Order[];
  products?: Product[];
  categories?: Category[];
  shop?: Shop;
  onAdd?: (number: number) => Promise<void>;
  onDelete?: (table: DiningTable) => Promise<void>;
  onAction?: (table: DiningTable, action: TableAction, extra?: TableActionOptions) => Promise<void>;
  onTransfer?: (table: DiningTable, toNumber: number) => Promise<void>;
  onOrderUpdated?: (order: Order) => void;
  onOrderRemoved?: (id: string) => void;
}

function tableTone(table: DiningTable): "call" | "busy" | "locked" | "empty" {
  if (table.hasCall) return "call";
  if (table.occupied) return "busy";
  if (table.locked) return "locked";
  return "empty";
}

function tableLabel(table: DiningTable): string {
  const tone = tableTone(table);
  if (tone === "call") return "ເອີ້ນ";
  if (tone === "busy") return "ມີລູກຄ້າ";
  if (tone === "locked") return "ຖືກລັອກ";
  return "ຫວ່າງ";
}

export function TableBoard({
  tables,
  canAdd = false,
  adding = false,
  orders = [],
  products = [],
  categories = [],
  shop,
  onAdd,
  onDelete,
  onAction,
  onTransfer,
  onOrderUpdated,
  onOrderRemoved,
}: BoardProps) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<DiningTable | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [actingId, setActingId] = useState("");
  const [boardError, setBoardError] = useState("");
  const nextNumber = (tables.reduce((max, table) => Math.max(max, table.number), 0) || 0) + 1;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const next = tables.find((table) => table.id === selected.id);
    if (!next) {
      setSelected(null);
      return;
    }
    if (
      next.hasOrder !== selected.hasOrder ||
      next.hasCall !== selected.hasCall ||
      next.occupied !== selected.occupied ||
      next.locked !== selected.locked ||
      next.occupiedAt !== selected.occupiedAt ||
      next.status !== selected.status
    ) {
      setSelected(next);
    }
  }, [tables, selected]);

  async function submitAdd(event: FormEvent) {
    event.preventDefault();
    const number = Number(draft || nextNumber);
    await onAdd?.(number);
    setDraft("");
  }

  async function quickLock(table: DiningTable, action: "lock" | "unlock") {
    if (!onAction) return;
    setActingId(table.id);
    setBoardError("");
    try {
      await onAction(table, action);
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : "ອັບເດດໂຕະບໍ່ສຳເລັດ.");
    } finally {
      setActingId("");
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-stone-900">ຈັດການໂຕະ</h2>
        {canAdd && (
          <form onSubmit={(event) => void submitAdd(event)} className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`ໂຕະ ${nextNumber}`}
              className="w-28 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="rounded-2xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {adding ? "ກຳລັງເພີ່ມ..." : "+ ເພີ່ມໂຕະໃໝ່"}
            </button>
          </form>
        )}
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> ຫວ່າງ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> ມີລູກຄ້າ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> ເອີ້ນພະນັກງານ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-400" /> ຖືກລັອກ
        </span>
      </div>
      {boardError && <p className="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{boardError}</p>}
      {tables.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີໂຕະ.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {tables.map((table) => {
            const tone = tableTone(table);
            const locking = actingId === table.id;
            return (
              <div
                key={table.id}
                className={`flex aspect-square flex-col rounded-3xl p-3 shadow-sm ${
                  tone === "call"
                    ? "bg-red-50 ring-2 ring-red-400"
                    : tone === "busy"
                      ? "bg-orange-50 ring-2 ring-orange-400"
                      : tone === "locked"
                        ? "bg-stone-200 ring-2 ring-stone-400"
                        : "bg-white ring-1 ring-stone-200"
                }`}
              >
                <button type="button" onClick={() => setSelected(table)} className="min-h-0 flex-1 text-left">
                  <p className="font-display text-xl text-stone-900 sm:text-2xl">ໂຕະ {table.number}</p>
                  {table.occupied && table.occupiedAt ? (
                    <p className="mt-1 text-[11px] font-medium leading-tight text-orange-800 sm:text-xs">
                      ເຂົ້າ {formatClock(table.occupiedAt)}
                      <span className="mt-0.5 block text-[10px] font-normal text-orange-700/80 sm:text-[11px]">
                        {formatElapsed(table.occupiedAt, now)}
                      </span>
                    </p>
                  ) : null}
                  <p
                    className={`mt-1 text-xs font-semibold sm:text-sm ${
                      tone === "call"
                        ? "text-red-700"
                        : tone === "busy"
                          ? "text-orange-700"
                          : tone === "locked"
                            ? "text-stone-600"
                            : "text-emerald-700"
                    }`}
                  >
                    {tableLabel(table)}
                  </p>
                </button>
                {onAction && !table.occupied && (
                  <button
                    type="button"
                    disabled={locking}
                    onClick={() => void quickLock(table, table.locked ? "unlock" : "lock")}
                    className={`mt-2 w-full rounded-xl py-1.5 text-[11px] font-semibold text-white sm:text-xs ${
                      table.locked ? "bg-emerald-700" : "bg-[#f4a261]"
                    } disabled:opacity-50`}
                  >
                    {locking ? "..." : table.locked ? "ປົດລັອກ" : "ລັອກໂຕະ"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {selected && (
        <TableQrModal
          table={selected}
          tables={tables}
          now={now}
          orders={orders.filter((order) => order.tableNumber === selected.number)}
          products={products}
          categories={categories}
          shop={shop}
          onClose={() => setSelected(null)}
          onAction={onAction ? (action, extra) => onAction(selected, action, extra) : undefined}
          onTransfer={onTransfer ? (toNumber) => onTransfer(selected, toNumber) : undefined}
          onDelete={onDelete ? () => onDelete(selected) : undefined}
          onOrderUpdated={onOrderUpdated}
          onOrderRemoved={onOrderRemoved}
        />
      )}
    </section>
  );
}

function TableQrModal({
  table,
  tables,
  now,
  orders,
  products,
  categories = [],
  shop,
  onClose,
  onAction,
  onTransfer,
  onDelete,
  onOrderUpdated,
  onOrderRemoved,
}: {
  table: DiningTable;
  tables: DiningTable[];
  now: number;
  orders: Order[];
  products: Product[];
  categories?: Category[];
  shop?: Shop;
  onClose: () => void;
  onAction?: (action: TableAction, extra?: TableActionOptions) => Promise<void>;
  onTransfer?: (toNumber: number) => Promise<void>;
  onDelete?: () => Promise<void>;
  onOrderUpdated?: (order: Order) => void;
  onOrderRemoved?: (id: string) => void;
}) {
  const url = menuUrlForTable(table.number);
  const [dataUrl, setDataUrl] = useState("");
  const [enlarged, setEnlarged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [acting, setActing] = useState<TableAction | "">("");
  const [transferring, setTransferring] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [toNumber, setToNumber] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [actionError, setActionError] = useState("");
  const [addingFirst, setAddingFirst] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const busy = Boolean(acting) || deleting || transferring || creating;
  const tone = tableTone(table);
  const emptyTargets = tables.filter((item) => item.id !== table.id && !item.occupied && !item.locked);
  const sessionOrders = sessionOrdersForTable(orders, table.occupiedAt);
  const sessionTotal = billTotal(mergeOrderItems(sessionOrders));
  const needsPayment = table.occupied && sessionTotal > 0;

  useEffect(() => {
    setShowTransfer(false);
    setToNumber("");
    setActionError("");
    setShowPay(false);
  }, [table.id]);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M" }).then((value) => {
      if (!cancelled) setDataUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function download() {
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `table-${table.number}-qr.png`;
    link.click();
  }

  async function run(action: TableAction, extra?: TableActionOptions) {
    if (!onAction) return;
    setActing(action);
    setActionError("");
    try {
      await onAction(action, extra);
      setShowPay(false);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ອັບເດດໂຕະບໍ່ສຳເລັດ.");
    } finally {
      setActing("");
    }
  }

  function requestClose() {
    if (needsPayment) {
      setActionError("");
      setShowPay(true);
      return;
    }
    void run("close");
  }

  function confirmPayment(paymentMethod: PaymentMethod) {
    void run("close", { paymentMethod });
  }

  async function confirmTransfer() {
    if (!onTransfer) return;
    const destination = Number(toNumber);
    if (!Number.isInteger(destination) || destination <= 0) {
      setActionError("ກະລຸນາເລືອກໂຕະປາຍທາງ.");
      return;
    }
    setTransferring(true);
    setActionError("");
    try {
      await onTransfer(destination);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ຍ້າຍໂຕະບໍ່ສຳເລັດ.");
    } finally {
      setTransferring(false);
    }
  }

  async function confirmRemove() {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "ລຶບໂຕະບໍ່ສຳເລັດ.");
    } finally {
      setDeleting(false);
    }
  }

  async function addFirstItem(product: Product, quantity: number) {
    setCreating(true);
    setActionError("");
    try {
      const created = await api.createOrder({
        tableNumber: table.number,
        items: [{ productId: product.id, quantity }],
      });
      onOrderUpdated?.(created);
      setAddingFirst(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ເພີ່ມເມນູບໍ່ສຳເລັດ.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 sm:items-center"
      onClick={() => {
        if (!confirmDelete && !addingFirst && !showPay) onClose();
      }}
    >
      <div
        className="relative mb-4 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl sm:mb-0"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="ປິດ"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xl leading-none text-stone-700"
        >
          ×
        </button>
        <p className="pr-10 font-display text-2xl text-stone-900">ໂຕະ {table.number}</p>
        <p
          className={`mt-1 text-sm font-semibold ${
            tone === "call"
              ? "text-red-700"
              : tone === "busy"
                ? "text-orange-800"
                : tone === "locked"
                  ? "text-stone-600"
                  : "text-emerald-700"
          }`}
        >
          {tableLabel(table)}
        </p>
        {table.occupied && table.occupiedAt ? (
          <p className="mt-1 text-sm font-medium text-orange-800">
            ເຂົ້າໂຕະ {formatClock(table.occupiedAt)} · {formatElapsed(table.occupiedAt, now)}
          </p>
        ) : table.locked ? (
          <p className="mt-1 text-sm text-stone-500">ລູກຄ້າສະແກນ QR ແລ້ວຈະເຫັນວ່າໂຕະຖືກລັອກ.</p>
        ) : (
          <p className="mt-1 text-sm text-stone-500">ລູກຄ້າສະແກນໄດ້ແຕ່ເບິ່ງເມນູ. ກົດເປີດໂຕະເພື່ອໃຫ້ສັ່ງອາຫານ.</p>
        )}
        {shop && sessionOrders.length > 0 && (
          <TableSessionBill
            tableNumber={table.number}
            occupiedAt={table.occupiedAt}
            orders={sessionOrders}
            products={products}
            categories={categories}
            shop={shop}
            onUpdated={onOrderUpdated}
            onRemoved={onOrderRemoved}
          />
        )}
        {shop && table.occupied && sessionOrders.length === 0 && products.length > 0 && onOrderUpdated && (
          <button
            type="button"
            disabled={creating}
            onClick={() => setAddingFirst(true)}
            className="mt-4 w-full rounded-2xl border border-orange-300 bg-orange-50 py-3 text-sm font-semibold text-orange-800 disabled:opacity-40"
          >
            + ເພີ່ມເມນູ
          </button>
        )}
        <p className="mt-1 break-all text-xs text-stone-500">{url}</p>
        {/https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url) && (
          <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ສະແກນດ້ວຍມືຖືທີ່ເຊື່ອມ Wi-Fi ດຽວກັນກັບຮ້ານ. ຖ້າຍັງບໍ່ເປີດໄດ້, ອະນຸຍາດ Vite/Node ຜ່ານ Windows Firewall.
          </p>
        )}
        <div className="mt-4 flex justify-center rounded-3xl bg-stone-50 p-4">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR ໂຕະ ${table.number}`} className="h-52 w-52" />
          ) : (
            <p className="py-16 text-sm text-stone-400">ກຳລັງສ້າງ QR...</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={download} disabled={!dataUrl} className="rounded-2xl bg-stone-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
            ດາວໂຫຼດ
          </button>
          <button type="button" onClick={() => setEnlarged(true)} disabled={!dataUrl} className="rounded-2xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-60">
            ຂະຫຍາຍໃຫ້ສະແກນ
          </button>
        </div>
        {actionError && !showPay && <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
        {onAction && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {table.occupied ? (
              <>
                {onTransfer && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setActionError("");
                        setShowTransfer((open) => !open);
                      }}
                      className="col-span-2 rounded-2xl bg-sky-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      ຍ້າຍໂຕະ
                    </button>
                    {showTransfer && (
                      <div className="col-span-2 rounded-2xl bg-sky-50 p-3">
                        <label className="block text-sm font-medium text-stone-700">
                          ຍ້າຍອໍເດີໄປໂຕະ
                          <select
                            value={toNumber}
                            onChange={(event) => setToNumber(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500"
                          >
                            <option value="">ເລືອກໂຕະຫວ່າງ</option>
                            {emptyTargets.map((item) => (
                              <option key={item.id} value={item.number}>
                                ໂຕະ {item.number}
                              </option>
                            ))}
                          </select>
                        </label>
                        {emptyTargets.length === 0 && (
                          <p className="mt-2 text-xs text-stone-500">ບໍ່ມີໂຕະຫວ່າງໃຫ້ຍ້າຍ.</p>
                        )}
                        <button
                          type="button"
                          disabled={busy || !toNumber}
                          onClick={() => void confirmTransfer()}
                          className="mt-2 w-full rounded-xl bg-sky-700 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {transferring ? "ກຳລັງຍ້າຍ..." : "ຢືນຢັນຍ້າຍ"}
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={requestClose}
                  className="col-span-2 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {acting === "close"
                    ? "ກຳລັງປິດ..."
                    : needsPayment
                      ? "ຢືນຢັນຊຳລະ ແລະ ປິດໂຕະ"
                      : "ປິດໂຕະ"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run("open")}
                  className="rounded-2xl bg-orange-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {acting === "open" ? "ກຳລັງເປີດ..." : "ເປີດໂຕະ"}
                </button>
                {table.locked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("unlock")}
                    className="rounded-2xl bg-stone-700 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {acting === "unlock" ? "ກຳລັງປົດ..." : "ປົດລັອກ"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run("lock")}
                    className="rounded-2xl bg-[#f4a261] py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {acting === "lock" ? "ກຳລັງລັອກ..." : "ລັອກໂຕະ"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDeleteError("");
              setConfirmDelete(true);
            }}
            className="mt-2 w-full rounded-2xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            ລຶບໂຕະ
          </button>
        )}
      </div>
      {showPay && (
        <CloseTablePaymentModal
          tableNumber={table.number}
          total={sessionTotal}
          submitting={acting === "close"}
          error={actionError}
          onConfirm={confirmPayment}
          onCancel={() => {
            if (acting === "close") return;
            setShowPay(false);
            setActionError("");
          }}
        />
      )}
      {addingFirst && (
        <AddOrderItemDialog
          products={products}
          categories={categories}
          onAdd={(product, quantity) => void addFirstItem(product, quantity)}
          onClose={() => setAddingFirst(false)}
        />
      )}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            event.stopPropagation();
            if (!deleting) setConfirmDelete(false);
          }}
          role="presentation"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
          >
            <h2 className="font-display text-xl">ລຶບໂຕະ</h2>
            <p className="mt-3 text-stone-700">ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບໂຕະນີ້?</p>
            <p className="mt-1 font-semibold text-stone-900">ໂຕະ {table.number}</p>
            {deleteError && <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmRemove()}
                className="flex-1 rounded-2xl bg-red-600 py-3 font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "ກຳລັງລຶບ..." : "ຢືນຢັນ"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-800"
              >
                ຍົກເລີກ
              </button>
            </div>
          </div>
        </div>
      )}
      {enlarged && dataUrl && (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white px-6"
          onClick={(event) => {
            event.stopPropagation();
            setEnlarged(false);
          }}
        >
          <p className="font-display text-3xl text-stone-900">ໂຕະ {table.number}</p>
          <p className="mt-1 text-sm text-stone-500">ສະແກນເພື່ອເຂົ້າເມນູ</p>
          <img src={dataUrl} alt="" className="mt-6 w-full max-w-md" />
          <button type="button" className="mt-8 rounded-2xl bg-stone-900 px-8 py-3 font-semibold text-white">
            ປິດ
          </button>
        </div>
      )}
    </div>
  );
}
