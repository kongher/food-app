import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { digitsOnly, formatGroupedAmount, formatVnd } from "../lib/format";
import { PAYMENT_METHOD_LABEL } from "../lib/payment";
import type { PaymentMethod } from "../types";

export function CloseTablePaymentModal({
  tableNumber,
  total,
  submitting,
  error,
  onConfirm,
  onCancel,
}: {
  tableNumber: number;
  total: number;
  submitting: boolean;
  error: string;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [receivedDigits, setReceivedDigits] = useState("");
  const [amountFocused, setAmountFocused] = useState(false);
  const [localError, setLocalError] = useState("");

  const received = useMemo(() => {
    if (!receivedDigits) return null;
    const amount = Number(receivedDigits);
    return Number.isFinite(amount) ? amount : null;
  }, [receivedDigits]);

  const change = method === "cash" && received != null ? received - total : null;
  const shortCash = method === "cash" && received != null && received < total;
  const receivedDisplay = formatGroupedAmount(receivedDigits);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  function onAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setReceivedDigits(digitsOnly(event.target.value));
    setLocalError("");
  }

  function submit() {
    if (submitting) return;
    if (method !== "cash" && method !== "transfer") {
      setLocalError("ກະລຸນາເລືອກວິທີຊຳລະ.");
      return;
    }
    if (shortCash) {
      setLocalError("ຈຳນວນເງິນລູກຄ້າສົ່ງຍັງບໍ່ພຽງພໍ.");
      return;
    }
    setLocalError("");
    onConfirm(method);
  }

  const message = localError || error;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        event.stopPropagation();
        if (!submitting) onCancel();
      }}
      role="presentation"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="close-table-pay-title"
      >
        <h2 id="close-table-pay-title" className="font-display text-xl text-stone-900">
          ຢືນຢັນຊຳລະ ແລະ ປິດໂຕະ
        </h2>
        <p className="mt-1 text-sm text-stone-500">ໂຕະ {tableNumber} · ເລືອກວິທີຈ່າຍເງິນ</p>
        <p className="font-display mt-4 text-3xl text-orange-700">{formatVnd(total)}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["cash", "transfer"] as const).map((value) => {
            const active = method === value;
            return (
              <button
                key={value}
                type="button"
                disabled={submitting}
                onClick={() => {
                  setMethod(value);
                  setLocalError("");
                }}
                className={`rounded-2xl border px-3 py-3 text-sm font-semibold disabled:opacity-50 ${
                  active
                    ? value === "cash"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-sky-500 bg-sky-50 text-sky-800"
                    : "border-stone-200 bg-white text-stone-700"
                }`}
              >
                {PAYMENT_METHOD_LABEL[value]}
              </button>
            );
          })}
        </div>

        {method === "cash" && (
          <label className="mt-4 block text-sm font-medium text-stone-700">
            ຈຳນວນເງິນລູກຄ້າສົ່ງ
            <span className="relative mt-1 block">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                disabled={submitting}
                value={receivedDigits}
                onChange={onAmountChange}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base text-transparent caret-transparent outline-none focus:border-orange-500"
                aria-label="ຈຳນວນເງິນລູກຄ້າສົ່ງ"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center px-3 text-base tabular-nums">
                {receivedDisplay ? (
                  <span className="text-stone-900">
                    {receivedDisplay}
                    {amountFocused && (
                      <span className="ml-px inline-block h-5 w-px animate-pulse bg-orange-600 align-middle" />
                    )}
                  </span>
                ) : (
                  <span className="text-stone-400">ຕົວຢ່າງ 1.000.000</span>
                )}
              </span>
            </span>
          </label>
        )}

        {method === "cash" && received != null && (
          <p
            className={`mt-2 rounded-2xl px-3 py-2 text-sm font-semibold ${
              shortCash ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {shortCash ? `ຍັງຂາດ ${formatVnd(total - received)}` : `ເງິນທອນ ${formatVnd(change ?? 0)}`}
          </p>
        )}

        {message && <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="flex-1 rounded-2xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "ກຳລັງບັນທຶກ..." : "ສຳເລັດ"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-800"
          >
            ຍົກເລີກ
          </button>
        </div>
      </div>
    </div>
  );
}
