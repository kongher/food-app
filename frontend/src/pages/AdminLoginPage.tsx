import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ShopBrand } from "../components/ShopBrand";
import { useShop } from "../context/ShopContext";
import { isAdminLoggedIn, saveSession } from "../lib/session";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { shop } = useShop();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAdminLoggedIn()) {
    return <Navigate to="/admin" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const session = await api.login({ username: "admin", password });
      if (session.role !== "admin") {
        setError("ບັນຊີນີ້ບໍ່ແມ່ນເຈົ້າຂອງຮ້ານ.");
        return;
      }
      saveSession({
        token: session.token,
        role: session.role,
        username: session.username,
        mustChangePassword: Boolean(session.mustChangePassword),
      });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#fff7ed] px-5">
      <form onSubmit={(event) => void onSubmit(event)} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm">
        <ShopBrand
          className={shop.logo ? "flex-col items-start gap-3" : ""}
          logoClassName="h-14 w-14 rounded-full object-cover"
          nameClassName="text-xs font-semibold text-orange-700"
        />
        <h1 className="font-display mt-2 text-3xl text-stone-900">ເຂົ້າສູ່ລະບົບຮ້ານ</h1>
        <p className="mt-2 text-sm text-stone-500">ປ້ອນລະຫັດເພື່ອເຂົ້າແຜງຄວບຄຸມ</p>
        <label className="mt-6 block text-sm font-medium text-stone-700">
          ລະຫັດຜ່ານ
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            autoFocus
            autoComplete="current-password"
            className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:border-orange-500"
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "ກຳລັງເຂົ້າ..." : "ເຂົ້າສູ່ລະບົບ"}
        </button>
        <Link to="/staff/login" className="mt-4 block text-center text-sm text-blue-600 underline">
          ພະນັກງານ · ເຂົ້າວຽກ
        </Link>
      </form>
    </div>
  );
}
