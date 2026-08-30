import { useMemo, useState, type FormEvent } from "react";
import { api, type LoginResponse } from "../api";
import { saveSession } from "../lib/session";
import {
  PASSWORD_METER_SEGMENTS,
  PASSWORD_RULES,
  isStrongPassword,
  passwordMeterLabel,
  passwordMeterScore,
  passwordMeterTone,
  passwordPolicyError,
} from "../lib/password";

export function ChangePasswordForm({
  forced = false,
  onSuccess,
}: {
  forced?: boolean;
  onSuccess?: (session: LoginResponse) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tone = passwordMeterTone(newPassword);
  const score = passwordMeterScore(newPassword);
  const strong = isStrongPassword(newPassword);
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const confirmOk = confirmPassword.length > 0 && confirmPassword === newPassword;

  const liveError = useMemo(() => {
    if (!newPassword) return "";
    return passwordPolicyError(newPassword) ?? "";
  }, [newPassword]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword) {
      setError("ກະລຸນາໃສ່ລະຫັດຜ່ານປັດຈຸບັນ.");
      return;
    }
    const policy = passwordPolicyError(newPassword);
    if (policy) {
      setError(policy);
      return;
    }
    if (newPassword === currentPassword) {
      setError("ລະຫັດຜ່ານໃໝ່ຕ້ອງແຕກຕ່າງຈາກລະຫັດປັດຈຸບັນ.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("ລະຫັດຜ່ານໃໝ່ບໍ່ກົງກັນ. ກະລຸນາໃສ່ຄືນ 2 ຄັ້ງ.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const session = await api.changePassword({ currentPassword, newPassword, confirmPassword });
      saveSession(session);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess?.(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl text-stone-900">
        {forced ? "ປ່ຽນລະຫັດຜ່ານເລີ່ມຕົ້ນ" : "ປ່ຽນລະຫັດຜ່ານ"}
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        {forced
          ? "ທ່ານກຳລັງໃຊ້ລະຫັດຜ່ານເລີ່ມຕົ້ນ (123456). ຕ້ອງປ່ຽນກ່ອນເຂົ້າໃຊ້ງານ."
          : "ປ່ຽນລະຫັດແລ້ວ ອຸປະກອນອື່ນຈະຖືກອອກຈາກລະບົບ."}
      </p>

      <label className="mt-5 block text-sm font-medium text-stone-700">
        ລະຫັດຜ່ານປັດຈຸບັນ
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setError("");
          }}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-orange-500"
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-stone-700">
        ລະຫັດຜ່ານໃໝ່
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setError("");
          }}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-orange-500"
        />
      </label>

      <div className="mt-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-stone-500">ຄວາມແຂງແຮງຂອງລະຫັດ</p>
          {tone !== "empty" && (
            <p
              className={`text-xs font-semibold ${
                tone === "strong" ? "text-emerald-700" : tone === "fair" ? "text-amber-600" : "text-red-600"
              }`}
            >
              {passwordMeterLabel(tone)}
            </p>
          )}
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden="true">
          {Array.from({ length: PASSWORD_METER_SEGMENTS }, (_, index) => {
            const filled = strong || index < score;
            let color = "bg-stone-200";
            if (filled && strong) color = "bg-emerald-500";
            else if (filled && tone === "fair") color = "bg-amber-400";
            else if (filled) color = "bg-red-500";
            return (
              <span
                key={index}
                className={`h-4 flex-1 rounded-md ${color}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(newPassword);
            const idle = !newPassword;
            return (
              <span
                key={rule.id}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  met
                    ? "bg-emerald-100 text-emerald-800"
                    : idle
                      ? "bg-stone-100 text-stone-500"
                      : "bg-red-50 text-red-700"
                }`}
              >
                {met ? "✓" : "•"} {rule.label}
              </span>
            );
          })}
        </div>
        {liveError && <p className="mt-2 text-sm text-red-600">{liveError}</p>}
      </div>

      <label className="mt-4 block text-sm font-medium text-stone-700">
        ຢືນຢັນລະຫັດຜ່ານໃໝ່
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setError("");
          }}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 outline-none focus:border-orange-500"
        />
      </label>
      {confirmMismatch && (
        <p className="mt-2 text-sm text-red-600">ລະຫັດຜ່ານໃໝ່ບໍ່ກົງກັນ. ກະລຸນາໃສ່ຄືນ 2 ຄັ້ງ.</p>
      )}
      {confirmOk && <p className="mt-2 text-sm text-emerald-700">ລະຫັດຜ່ານໃໝ່ກົງກັນແລ້ວ.</p>}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "ກຳລັງບັນທຶກ..." : "ປ່ຽນລະຫັດຜ່ານ"}
      </button>
    </form>
  );
}
