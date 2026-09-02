import { useEffect, useState } from "react";
import { api } from "../api";
import { onImgError } from "../lib/format";
import type { Promotion } from "../types";

export function GuestPromotionsPanel() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void api
      .getPromotions()
      .then((list) => {
        if (!cancelled) setPromotions(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "ໂຫຼດໂປຣໂມຊັນບໍ່ສຳເລັດ.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(""), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  async function copyCode(promo: Promotion) {
    if (!promo.code) return;
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopiedId(promo.id);
    } catch {
      setCopiedId(promo.id);
    }
  }

  if (loading) {
    return <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ກຳລັງໂຫຼດ...</p>;
  }

  if (error) {
    return <p className="rounded-3xl bg-red-50 p-8 text-center text-sm text-red-700">{error}</p>;
  }

  if (promotions.length === 0) {
    return (
      <article className="rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-4xl">🏷️</p>
        <h2 className="font-display mt-3 text-2xl text-stone-900">ໂປຣໂມຊັນ / ສ່ວນຫຼຸດ</h2>
        <p className="mt-2 text-sm text-stone-500">ຍັງບໍ່ມີໂປຣໂມຊັນໃນຂະນະນີ້.</p>
      </article>
    );
  }

  return (
    <div className="space-y-4">
      {promotions.map((promo) => (
        <article key={promo.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {promo.image && (
            <img src={promo.image} alt="" className="h-44 w-full object-cover" onError={onImgError} />
          )}
          <div className="p-5">
            {!promo.image && <p className="text-3xl">🏷️</p>}
            <h2 className="font-display text-2xl text-stone-900">{promo.title}</h2>
            {promo.body && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{promo.body}</p>}
            {promo.code && (
              <div className="mt-4 rounded-2xl bg-orange-50 px-4 py-3">
                <p className="text-xs font-medium text-orange-700">ລະຫັດສ່ວນຫຼຸດ</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="font-mono text-lg font-bold tracking-widest text-orange-800">{promo.code}</p>
                  <button
                    type="button"
                    onClick={() => void copyCode(promo)}
                    className="shrink-0 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {copiedId === promo.id ? "ສຳເນົາແລ້ວ" : "ສຳເນົາ"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
