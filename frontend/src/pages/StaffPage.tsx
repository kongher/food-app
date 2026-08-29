import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ShopBrand } from "../components/ShopBrand";
import { TableBoard } from "../components/TableBoard";
import { CartProvider } from "../context/CartContext";
import { playStaffAlert, unlockAudio } from "../lib/alert";
import { connectDeskSocket } from "../lib/deskSocket";
import { formatTime } from "../lib/format";
import { getSession, logoutSession } from "../lib/session";
import { staffCallLabel, staffCallTimes, staffCallWhen } from "../lib/staffCall";
import type { Category, DiningTable, Product, StaffCall, TableAction } from "../types";
import { CustomerMenu } from "./CustomerPage";

type StaffTab = "calls" | "tables" | "menu";

export function StaffPage() {
  return (
    <CartProvider>
      <StaffDashboard />
    </CartProvider>
  );
}

function StaffDashboard() {
  const navigate = useNavigate();
  const session = getSession();
  const [tab, setTab] = useState<StaffTab>("calls");
  const [calls, setCalls] = useState<StaffCall[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tables, setTables] = useState<DiningTable[]>([]);
  const knownCallTimes = useRef<Map<string, number> | null>(null);

  const pendingCalls = useMemo(() => calls.filter((call) => call.status === "pending"), [calls]);

  async function loadCalls(options?: { detectNew?: boolean }) {
    const data = await api.getCalls();
    if (options?.detectNew && knownCallTimes.current) {
      const louder = data.some((call) => {
        if (call.status !== "pending") return false;
        const prev = knownCallTimes.current?.get(call.id);
        const times = staffCallTimes(call);
        return prev === undefined || times > prev;
      });
      if (louder) playStaffAlert({ force: true, vibrate: true });
    }
    knownCallTimes.current = new Map(data.map((call) => [call.id, staffCallTimes(call)]));
    setCalls(data);
    void api.getTables().then(setTables).catch(() => undefined);
  }

  async function loadMenu() {
    setMenuLoading(true);
    try {
      const data = await api.getMenu();
      setProducts(data.products);
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ໂຫຼດເມນູບໍ່ສຳເລັດ.");
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => {
    void loadCalls()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "ໂຫຼດຄຳຮ້ອງຂໍບໍ່ສຳເລັດ.");
      })
      .finally(() => setLoading(false));

    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });

    const socket = connectDeskSocket();
    socket.on("calls", (payload: { type?: string }) => {
      if (payload.type === "created" || payload.type === "repeated") {
        playStaffAlert({ force: true, vibrate: true });
      }
      void loadCalls();
    });
    socket.on("orders", () => {
      void api.getTables().then(setTables).catch(() => undefined);
    });

    socket.on("tables", () => {
      void api.getTables().then(setTables).catch(() => undefined);
    });

    const poll = window.setInterval(() => {
      void loadCalls({ detectNew: true });
    }, 8000);

    return () => {
      socket.disconnect();
      window.clearInterval(poll);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  useEffect(() => {
    if (tab === "menu" && products.length === 0 && !menuLoading) {
      void loadMenu();
    }
  }, [tab, products.length, menuLoading]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function resolveCall(id: string) {
    try {
      await api.resolveCall(id);
      await loadCalls();
      setMessage("ຮັບຄຳຮ້ອງຂໍແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ອັບເດດຄຳຮ້ອງຂໍບໍ່ສຳເລັດ.");
    }
  }

  async function setTableStatus(table: DiningTable, action: TableAction) {
    setError("");
    await api.setTableAction(table.id, action);
    setTables(await api.getTables());
    const messages: Record<TableAction, string> = {
      open: `ເປີດໂຕະ ${table.number} ແລ້ວ.`,
      close: `ປິດໂຕະ ${table.number} ແລ້ວ.`,
      lock: `ລັອກໂຕະ ${table.number} ແລ້ວ.`,
      unlock: `ປົດລັອກໂຕະ ${table.number} ແລ້ວ.`,
    };
    setMessage(messages[action]);
  }

  async function transferTable(table: DiningTable, toNumber: number) {
    setError("");
    await api.transferTable(table.id, toNumber);
    const [nextTables, nextCalls] = await Promise.all([api.getTables(), api.getCalls()]);
    setTables(nextTables);
    setCalls(nextCalls);
    setMessage(`ຍ້າຍອໍເດີຈາກໂຕະ ${table.number} ໄປໂຕະ ${toNumber} ແລ້ວ.`);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-[#fff7ed]">
      <header className="sticky top-0 z-20 border-b border-orange-100 bg-[#fff7ed]/95 px-4 pt-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <ShopBrand />
            <h1 className="font-display text-xl text-stone-900">ພະນັກງານ</h1>
            <p className="text-xs text-stone-500">{session?.username}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logoutSession();
              navigate("/staff/login", { replace: true });
            }}
            className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-500"
          >
            ອອກ
          </button>
        </div>
        <nav className="mt-3 flex">
          <button
            type="button"
            onClick={() => setTab("calls")}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold ${
              tab === "calls" ? "border-orange-600 text-orange-700" : "border-transparent text-stone-400"
            }`}
          >
            ແຈ້ງເຕືອນ
            {pendingCalls.length > 0 && (
              <span className="rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">{pendingCalls.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("tables")}
            className={`flex flex-1 items-center justify-center border-b-2 py-2.5 text-sm font-semibold ${
              tab === "tables" ? "border-orange-600 text-orange-700" : "border-transparent text-stone-400"
            }`}
          >
            ໂຕະ
          </button>
          <button
            type="button"
            onClick={() => setTab("menu")}
            className={`flex flex-1 items-center justify-center border-b-2 py-2.5 text-sm font-semibold ${
              tab === "menu" ? "border-orange-600 text-orange-700" : "border-transparent text-stone-400"
            }`}
          >
            ເມນູ
          </button>
        </nav>
      </header>

      {message && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-6" onClick={() => setMessage("")}>
          <div className="max-w-sm rounded-3xl bg-white px-8 py-7 text-center shadow-xl" onClick={(event) => event.stopPropagation()}>
            <p className="text-4xl">✅</p>
            <p className="font-display mt-3 text-xl text-stone-900">{message}</p>
          </div>
        </div>
      )}

      {tab === "calls" && (
        <main className="px-4 pt-4 pb-8">
          {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {loading && <p className="py-10 text-center text-stone-500">ກຳລັງໂຫຼດ...</p>}
          {!loading && calls.length === 0 && (
            <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີຄຳຮ້ອງຂໍ.</p>
          )}
          <div className="space-y-3">
            {calls.map((call) => (
              <article
                key={call.id}
                className={`rounded-3xl bg-white p-4 shadow-sm ${
                  call.status === "pending" ? "ring-2 ring-orange-400" : "opacity-75"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-2xl text-stone-900">ໂຕະ {call.tableNumber}</p>
                      {staffCallTimes(call) > 1 && (
                        <span className="rounded-full bg-orange-500 px-2 py-0.5 text-sm font-bold text-white">
                          {staffCallTimes(call)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-lg font-semibold text-orange-700">{staffCallLabel(call)}</p>
                    <p className="text-sm text-stone-500">{formatTime(staffCallWhen(call))}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                      call.status === "pending" ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {call.status === "pending" ? "ລໍຖ້າ" : "ຮັບແລ້ວ"}
                  </span>
                </div>
                {call.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void resolveCall(call.id)}
                    className="mt-4 w-full rounded-2xl bg-emerald-600 py-3 font-semibold text-white"
                  >
                    ຮັບແລ້ວ
                  </button>
                )}
              </article>
            ))}
          </div>
        </main>
      )}

      {tab === "tables" && (
        <main className="px-4 pt-4 pb-8">
          {error && <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <TableBoard tables={tables} onAction={setTableStatus} onTransfer={transferTable} />
        </main>
      )}

      {tab === "menu" && (
        <CustomerMenu
          variant="staff"
          products={products}
          categories={categories}
          loading={menuLoading}
          error={error}
        />
      )}
    </div>
  );
}
