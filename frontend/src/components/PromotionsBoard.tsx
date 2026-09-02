import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { formatTime, onImgError } from "../lib/format";
import type { Promotion, PromotionInput } from "../types";

const emptyForm: PromotionInput = {
  title: "",
  body: "",
  code: "",
  image: "",
  active: true,
};

export function PromotionsBoard({
  onMessage,
  onError,
}: {
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PromotionInput>(emptyForm);
  const [editForm, setEditForm] = useState<PromotionInput>(emptyForm);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadPromotions() {
    setPromotions(await api.getAllPromotions());
  }

  useEffect(() => {
    let cancelled = false;
    void loadPromotions()
      .catch((err: unknown) => {
        if (!cancelled) onError(err instanceof Error ? err.message : "ໂຫຼດໂປຣໂມຊັນບໍ່ສຳເລັດ.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    if (!editing && !deleting) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (deleting) {
        setDeleting(null);
        return;
      }
      setEditing(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, deleting]);

  async function uploadImage(file: File, target: "add" | "edit") {
    setUploading(true);
    onError("");
    try {
      const url = await api.uploadImage(file);
      if (target === "edit") setEditForm((current) => ({ ...current, image: url }));
      else setForm((current) => ({ ...current, image: url }));
    } catch (err) {
      onError(err instanceof Error ? err.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ.");
    } finally {
      setUploading(false);
    }
  }

  async function savePromotion(event: FormEvent, mode: "add" | "edit") {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      if (mode === "edit" && editing) {
        await api.updatePromotion(editing.id, editForm);
        setEditing(null);
        setEditForm(emptyForm);
        onMessage("ອັບເດດໂປຣໂມຊັນແລ້ວ.");
      } else {
        await api.createPromotion(form);
        setForm(emptyForm);
        onMessage("ເພີ່ມໂປຣໂມຊັນແລ້ວ.");
      }
      await loadPromotions();
    } catch (err) {
      onError(err instanceof Error ? err.message : "ບັນທຶກໂປຣໂມຊັນບໍ່ສຳເລັດ.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setRemoving(true);
    onError("");
    try {
      await api.deletePromotion(deleting.id);
      setDeleting(null);
      await loadPromotions();
      onMessage("ລຶບໂປຣໂມຊັນແລ້ວ.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "ລຶບໂປຣໂມຊັນບໍ່ສຳເລັດ.");
    } finally {
      setRemoving(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    onError("");
    try {
      await api.setPromotionActive(promo.id, !promo.active);
      await loadPromotions();
    } catch (err) {
      onError(err instanceof Error ? err.message : "ອັບເດດສະຖານະບໍ່ສຳເລັດ.");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <PromotionForm
        title="ເພີ່ມໂປຣໂມຊັນ"
        form={form}
        setForm={setForm}
        saving={saving}
        uploading={uploading}
        submitLabel={saving ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມ"}
        onUpload={(file) => void uploadImage(file, "add")}
        onSubmit={(event) => void savePromotion(event, "add")}
      />

      <div>
        <h2 className="font-display text-xl text-stone-900">ລາຍການໂປຣໂມຊັນ</h2>
        <p className="mt-1 text-sm text-stone-500">ລູກຄ້າຈະເຫັນລາຍການທີ່ເປີດສະແດງໃນແທັບໂປຣໂມຊັນ.</p>
        {loading && <p className="mt-6 text-stone-500">ກຳລັງໂຫຼດ...</p>}
        {!loading && promotions.length === 0 && (
          <p className="mt-6 rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີໂປຣໂມຊັນ.</p>
        )}
        <div className="mt-4 space-y-3">
          {promotions.map((promo) => (
            <article key={promo.id} className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                {promo.image ? (
                  <img
                    src={promo.image}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                    onError={onImgError}
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                    🏷️
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900">{promo.title}</p>
                      {promo.code && (
                        <p className="mt-0.5 font-mono text-sm font-bold tracking-wide text-orange-700">{promo.code}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        promo.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {promo.active ? "ສະແດງ" : "ເຊື່ອງ"}
                    </span>
                  </div>
                  {promo.body && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{promo.body}</p>}
                  <p className="mt-1 text-xs text-stone-400">{formatTime(promo.updatedAt || promo.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(promo);
                    setEditForm({
                      title: promo.title,
                      body: promo.body,
                      code: promo.code,
                      image: promo.image,
                      active: promo.active,
                    });
                  }}
                  className="rounded-full bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  ແກ້ໄຂ
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive(promo)}
                  className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800"
                >
                  {promo.active ? "ເຊື່ອງ" : "ສະແດງ"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(promo)}
                  className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                >
                  ລຶບ
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => !saving && setEditing(null)}
          role="presentation"
        >
          <div
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <PromotionForm
              title="ແກ້ໄຂໂປຣໂມຊັນ"
              form={editForm}
              setForm={setEditForm}
              saving={saving}
              uploading={uploading}
              submitLabel={saving ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              onUpload={(file) => void uploadImage(file, "edit")}
              onSubmit={(event) => void savePromotion(event, "edit")}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !removing && setDeleting(null)}
          role="presentation"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-display text-xl">ລຶບໂປຣໂມຊັນ</h2>
            <p className="mt-3 text-stone-700">ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບລາຍການນີ້?</p>
            <p className="mt-1 font-semibold text-stone-900">{deleting.title}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => void confirmDelete()}
                className="flex-1 rounded-2xl bg-red-600 py-3 font-semibold text-white disabled:opacity-60"
              >
                {removing ? "ກຳລັງລຶບ..." : "ຢືນຢັນ"}
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => setDeleting(null)}
                className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-800"
              >
                ຍົກເລີກ
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PromotionForm({
  title,
  form,
  setForm,
  saving,
  uploading,
  submitLabel,
  onUpload,
  onSubmit,
  onCancel,
}: {
  title: string;
  form: PromotionInput;
  setForm: (form: PromotionInput) => void;
  saving: boolean;
  uploading: boolean;
  submitLabel: string;
  onUpload: (file: File) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="h-fit rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl text-stone-900">{title}</h2>
      <p className="mt-1 text-sm text-stone-500">ສາມາດໃສ່ລະຫັດສ່ວນຫຼຸດ, ຂໍ້ຄວາມແຈ້ງການ ແລະ ຮູບ.</p>
      <label className="mt-4 block text-sm font-medium">
        ຫົວຂໍ້
        <input
          required
          maxLength={80}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="ຕົວຢ່າງ: ຫຼຸດ 10%"
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="mt-3 block text-sm font-medium">
        ຂໍ້ຄວາມແຈ້ງການ
        <textarea
          maxLength={1000}
          rows={4}
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
          placeholder="ລາຍລະອຽດໂປຣໂມຊັນ ຫຼື ແຈ້ງການໃຫ້ລູກຄ້າ"
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="mt-3 block text-sm font-medium">
        ລະຫັດສ່ວນຫຼຸດ
        <input
          maxLength={40}
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          placeholder="ຕົວຢ່າງ: SALE10"
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 font-mono tracking-wide"
        />
      </label>
      <label className="mt-3 block text-sm font-medium">
        ຮູບ
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-orange-700"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </label>
      {form.image ? (
        <div className="mt-3 flex items-center gap-3">
          <img src={form.image} alt="" className="h-20 w-20 rounded-2xl object-cover" onError={onImgError} />
          <button type="button" onClick={() => setForm({ ...form, image: "" })} className="text-sm text-red-600">
            ລຶບຮູບ
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-400">ຍັງບໍ່ມີຮູບ.</p>
      )}
      {uploading && <p className="mt-2 text-sm text-stone-500">ກຳລັງອັບໂຫຼດຮູບ...</p>}
      <label className="mt-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => setForm({ ...form, active: event.target.checked })}
        />
        ສະແດງໃຫ້ລູກຄ້າ
      </label>
      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={saving || uploading}
          className="flex-1 rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" disabled={saving} onClick={onCancel} className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-800">
            ຍົກເລີກ
          </button>
        )}
      </div>
    </form>
  );
}
