import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { formatTime } from "../lib/format";
import type { StaffAccount } from "../types";

const emptyForm = { name: "", username: "" };
const emptyEditForm = { name: "", username: "", password: "" };

export function StaffAccountsBoard({
  onMessage,
  onError,
}: {
  onMessage: (message: string) => void;
  onError: (error: string) => void;
}) {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [deleting, setDeleting] = useState<StaffAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function loadStaff() {
    const list = await api.getStaff();
    setStaff(list);
  }

  useEffect(() => {
    let cancelled = false;
    void loadStaff()
      .catch((err: unknown) => {
        if (!cancelled) onError(err instanceof Error ? err.message : "ໂຫຼດພະນັກງານບໍ່ສຳເລັດ.");
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

  async function saveStaff(event: FormEvent, mode: "add" | "edit") {
    event.preventDefault();
    setSaving(true);
    onError("");
    try {
      if (mode === "edit" && editing) {
        await api.updateStaff(editing.id, {
          name: editForm.name,
          username: editForm.username,
          password: editForm.password.trim() || undefined,
        });
        setEditing(null);
        setEditForm(emptyEditForm);
        onMessage("ອັບເດດບັນຊີພະນັກງານແລ້ວ.");
      } else {
        await api.createStaff({
          name: form.name,
          username: form.username,
        });
        setForm(emptyForm);
        onMessage("ເພີ່ມພະນັກງານແລ້ວ.");
      }
      await loadStaff();
    } catch (err) {
      onError(err instanceof Error ? err.message : "ບັນທຶກພະນັກງານບໍ່ສຳເລັດ.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setRemoving(true);
    onError("");
    try {
      await api.deleteStaff(deleting.id);
      setDeleting(null);
      await loadStaff();
      onMessage("ລຶບບັນຊີພະນັກງານແລ້ວ.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "ລຶບພະນັກງານບໍ່ສຳເລັດ.");
    } finally {
      setRemoving(false);
    }
  }

  function startEdit(account: StaffAccount) {
    setEditing(account);
    setEditForm({ name: account.name, username: account.username, password: "" });
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <form onSubmit={(event) => void saveStaff(event, "add")} className="h-fit rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl text-stone-900">ເພີ່ມພະນັກງານ</h2>
        <p className="mt-1 text-sm text-stone-500">ບັນຊີນີ້ໃຊ້ເພື່ອເຂົ້າໜ້າພະນັກງານ. ລະຫັດເລີ່ມຕົ້ນແມ່ນ 123456 ພະນັກງານຕ້ອງປ່ຽນເມື່ອເຂົ້າຄັ້ງທຳອິດ.</p>
        <label className="mt-4 block text-sm font-medium">
          ຊື່ພະນັກງານ
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="ຕົວຢ່າງ: ສົມຊາຍ"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          ຊື່ຜູ້ໃຊ້
          <input
            required
            autoComplete="off"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="staff2"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
          />
        </label>
        <p className="mt-3 rounded-2xl bg-orange-50 px-3 py-2 text-sm text-orange-800">
          ລະຫັດຜ່ານເລີ່ມຕົ້ນ: <span className="font-semibold">123456</span>
        </p>
        <button disabled={saving} className="mt-4 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60">
          {saving && !editing ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມບັນຊີ"}
        </button>
      </form>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-stone-900">ບັນຊີພະນັກງານ</h2>
          <button
            type="button"
            onClick={() => {
              onError("");
              void loadStaff().catch((err: unknown) => {
                onError(err instanceof Error ? err.message : "ໂຫຼດພະນັກງານບໍ່ສຳເລັດ.");
              });
            }}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium"
          >
            ໂຫຼດໃໝ່
          </button>
        </div>
        {loading && <p className="text-stone-500">ກຳລັງໂຫຼດ...</p>}
        {!loading && staff.length === 0 && (
          <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີພະນັກງານ.</p>
        )}
        <div className="space-y-3">
          {staff.map((account) => (
            <article key={account.id} className="flex flex-wrap items-start justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <p className="font-semibold text-stone-900">{account.name}</p>
                <p className="text-sm text-stone-500">@{account.username}</p>
                {account.mustChangePassword && (
                  <p className="mt-1 text-xs font-medium text-orange-700">ຍັງໃຊ້ລະຫັດເລີ່ມຕົ້ນ</p>
                )}
                <p className="mt-1 text-xs text-stone-400">{formatTime(account.createdAt)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(account)}
                  className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  ແກ້ໄຂ
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(account)}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditing(null)}
          role="presentation"
        >
          <form
            onSubmit={(event) => void saveStaff(event, "edit")}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 className="font-display text-xl">ແກ້ໄຂບັນຊີພະນັກງານ</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                ປິດ
              </button>
            </div>
            <label className="mt-3 block text-sm font-medium">
              ຊື່ພະນັກງານ
              <input
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              ຊື່ຜູ້ໃຊ້
              <input
                required
                autoComplete="off"
                value={editForm.username}
                onChange={(event) => setEditForm({ ...editForm, username: event.target.value })}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              ລະຫັດຜ່ານໃໝ່
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={editForm.password}
                onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                placeholder="ຫວ່າງໄວ້ຖ້າບໍ່ປ່ຽນ · ໃສ່ 123456 ເພື່ອຣີເຊັດ"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button disabled={saving} className="flex-1 rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60">
                {saving ? "ກຳລັງບັນທຶກ..." : "ອັບເດດ"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-2xl bg-stone-100 px-4">
                ຍົກເລີກ
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleting(null)}
          role="presentation"
        >
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="font-display text-xl">ລຶບບັນຊີພະນັກງານ</h2>
            <p className="mt-3 text-stone-700">ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບບັນຊີນີ້?</p>
            <p className="mt-1 font-semibold text-stone-900">
              {deleting.name} <span className="font-normal text-stone-500">@{deleting.username}</span>
            </p>
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
