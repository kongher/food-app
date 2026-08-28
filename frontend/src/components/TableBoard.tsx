import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { menuUrlForTable } from "../lib/tableSession";
import type { DiningTable } from "../types";

interface BoardProps {
  tables: DiningTable[];
  canAdd?: boolean;
  adding?: boolean;
  onAdd?: (number: number) => Promise<void>;
  onDelete?: (table: DiningTable) => Promise<void>;
  onClear?: (table: DiningTable) => Promise<void>;
}

export function TableBoard({ tables, canAdd = false, adding = false, onAdd, onDelete, onClear }: BoardProps) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<DiningTable | null>(null);
  const nextNumber = (tables.reduce((max, table) => Math.max(max, table.number), 0) || 0) + 1;

  useEffect(() => {
    if (!selected) return;
    const next = tables.find((table) => table.id === selected.id);
    if (!next) {
      setSelected(null);
      return;
    }
    if (next.hasOrder !== selected.hasOrder || next.hasCall !== selected.hasCall) {
      setSelected(next);
    }
  }, [tables, selected]);

  async function submitAdd(event: FormEvent) {
    event.preventDefault();
    const number = Number(draft || nextNumber);
    await onAdd?.(number);
    setDraft("");
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
      </div>
      {tables.length === 0 ? (
        <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີໂຕະ.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelected(table)}
              className={`aspect-square rounded-3xl p-3 text-left shadow-sm transition ${
                table.hasCall
                  ? "bg-red-50 ring-2 ring-red-400"
                  : table.hasOrder
                    ? "bg-orange-50 ring-2 ring-orange-400"
                    : "bg-white ring-1 ring-stone-200"
              }`}
            >
              <p className="font-display text-xl text-stone-900 sm:text-2xl">ໂຕະ {table.number}</p>
              <p
                className={`mt-1 text-xs font-semibold sm:text-sm ${
                  table.hasCall ? "text-red-700" : table.hasOrder ? "text-orange-700" : "text-emerald-700"
                }`}
              >
                {table.hasCall ? "ເອີ້ນ" : table.hasOrder ? "ມີລູກຄ້າ" : "ຫວ່າງ"}
              </p>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <TableQrModal
          table={selected}
          onClose={() => setSelected(null)}
          onClear={onClear ? () => onClear(selected) : undefined}
          onDelete={onDelete ? () => onDelete(selected) : undefined}
        />
      )}
    </section>
  );
}

function TableQrModal({
  table,
  onClose,
  onClear,
  onDelete,
}: {
  table: DiningTable;
  onClose: () => void;
  onClear?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const url = menuUrlForTable(table.number);
  const [dataUrl, setDataUrl] = useState("");
  const [enlarged, setEnlarged] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [clearError, setClearError] = useState("");
  const busy = clearing || deleting;

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

  async function markEmpty() {
    if (!onClear) return;
    setClearing(true);
    setClearError("");
    try {
      await onClear();
      onClose();
    } catch (err) {
      setClearError(err instanceof Error ? err.message : "ອັບເດດໂຕະບໍ່ສຳເລັດ.");
    } finally {
      setClearing(false);
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

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 sm:items-center"
      onClick={() => {
        if (!confirmDelete) onClose();
      }}
    >
      <div
        className="relative mb-4 w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl sm:mb-0"
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
        <p className="mt-1 break-all text-xs text-stone-500">{url}</p>
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
        {clearError && <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{clearError}</p>}
        {(onClear || onDelete) && (
          <div className={`mt-2 grid gap-2 ${onClear && onDelete ? "grid-cols-2" : "grid-cols-1"}`}>
            {onClear && (
              <button
                type="button"
                disabled={busy || !table.hasOrder}
                onClick={() => void markEmpty()}
                className="rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {clearing ? "ກຳລັງບັນທຶກ..." : "ຫວ່າງໂຕະ"}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
                className="rounded-2xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                ລຶບໂຕະ
              </button>
            )}
          </div>
        )}
      </div>
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
