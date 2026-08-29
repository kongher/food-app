import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiUrl } from "../api";
import { DateInput } from "../components/DateInput";
import { OrderCard } from "../components/OrderCard";
import { ShopBrand } from "../components/ShopBrand";
import { StaffAccountsBoard } from "../components/StaffAccountsBoard";
import { TableBoard } from "../components/TableBoard";
import { useShop } from "../context/ShopContext";
import { logoutAdmin } from "../lib/adminAuth";
import { getAuthToken } from "../lib/session";
import { staffCallLabel, staffCallTimes, staffCallWhen } from "../lib/staffCall";
import { playStaffAlert, unlockAudio } from "../lib/alert";
import {
  DEFAULT_VOICE_PITCH,
  DEFAULT_VOICE_RATE,
  buildVoiceMessage,
  findThaiVoice,
  getVoicePitch,
  getVoiceRate,
  isOrderSoundEnabled,
  playVoiceNotification,
  previewVoiceNotification,
  setOrderSoundEnabled,
  setVoicePitch,
  setVoiceRate,
  unlockOrderSound,
} from "../lib/orderSound";
import {
  endOfLocalDay,
  formatTime,
  formatVnd,
  isInLocalRange,
  onImgError,
  parseDateInput,
  startOfLocalDay,
  toDateInputValue,
  toDisplayDate,
} from "../lib/format";
import { matchesOrderSearch } from "../lib/orderCode";
import type { Category, DiningTable, Order, Product, ProductInput, StaffCall, TableAction } from "../types";

type Tab = "orders" | "calls" | "tables" | "reports" | "menu" | "staff" | "settings";
type ReportPreset = "today" | "yesterday" | "last7" | "month" | "custom";

const emptyForm: ProductInput = {
  name: "",
  price: 0,
  image: "",
  description: "",
  categoryId: "",
  available: true,
};

export function AdminPage() {
  const navigate = useNavigate();
  const { shop, setShop } = useShop();
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<StaffCall[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [editForm, setEditForm] = useState<ProductInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState<"idle" | "add" | "edit">("idle");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryEditId, setCategoryEditId] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [menuFilter, setMenuFilter] = useState("all");
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reportPreset, setReportPreset] = useState<ReportPreset>("today");
  const [fromInput, setFromInput] = useState(() => toDateInputValue(new Date()));
  const [toInput, setToInput] = useState(() => toDateInputValue(new Date()));
  const [appliedFrom, setAppliedFrom] = useState(() => toDateInputValue(new Date()));
  const [appliedTo, setAppliedTo] = useState(() => toDateInputValue(new Date()));
  const [filterError, setFilterError] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => isOrderSoundEnabled());
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [voiceRateDraft, setVoiceRateDraft] = useState(() => getVoiceRate());
  const [voicePitchDraft, setVoicePitchDraft] = useState(() => getVoicePitch());
  const [shopNameDraft, setShopNameDraft] = useState("");
  const [shopLogoDraft, setShopLogoDraft] = useState("");
  const [savingShop, setSavingShop] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [addingTable, setAddingTable] = useState(false);
  const knownOrderIds = useRef<Set<string> | null>(null);
  const knownCallTimes = useRef<Map<string, number> | null>(null);

  async function loadOrders(options?: { detectNew?: boolean }) {
    const data = await api.getOrders();
    if (options?.detectNew && knownOrderIds.current) {
      const newcomers = data.filter((order) => !knownOrderIds.current?.has(order.id));
      for (const order of newcomers) playVoiceNotification(order.tableNumber);
    }
    knownOrderIds.current = new Set(data.map((order) => order.id));
    setOrders(data);
  }

  async function loadCalls(options?: { detectNew?: boolean }) {
    const data = await api.getCalls();
    if (options?.detectNew && knownCallTimes.current) {
      const louder = data.some((call) => {
        if (call.status !== "pending") return false;
        const prev = knownCallTimes.current?.get(call.id);
        const times = Math.max(1, Number(call.times) || 1);
        return prev === undefined || times > prev;
      });
      if (louder) playStaffAlert();
    }
    knownCallTimes.current = new Map(data.map((call) => [call.id, Math.max(1, Number(call.times) || 1)]));
    setCalls(data);
  }

  async function loadMenu() {
    const [productList, categoryList] = await Promise.all([api.getProducts(), api.getCategories()]);
    setProducts(productList);
    setCategories(categoryList);
    setForm((current) => ({
      ...current,
      categoryId: current.categoryId || categoryList[0]?.id || "",
    }));
  }

  async function loadTables() {
    setTables(await api.getTables());
  }

  async function addTable(number: number) {
    setAddingTable(true);
    setError("");
    try {
      await api.createTable({ number });
      await loadTables();
      setMessage("ເພີ່ມໂຕະແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເພີ່ມໂຕະບໍ່ສຳເລັດ.");
    } finally {
      setAddingTable(false);
    }
  }

  async function removeTable(table: DiningTable) {
    setError("");
    await api.deleteTable(table.id);
    await loadTables();
    setMessage(`ລຶບໂຕະ ${table.number} ແລ້ວ.`);
  }

  async function setTableStatus(table: DiningTable, action: TableAction) {
    setError("");
    await api.setTableAction(table.id, action);
    await loadTables();
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
    await Promise.all([loadTables(), loadOrders(), loadCalls()]);
    setMessage(`ຍ້າຍອໍເດີຈາກໂຕະ ${table.number} ໄປໂຕະ ${toNumber} ແລ້ວ.`);
  }

  async function refreshAll() {
    setError("");
    try {
      await Promise.all([loadOrders(), loadCalls(), loadMenu(), loadTables()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    const unlock = () => {
      unlockAudio();
      unlockOrderSound();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const token = encodeURIComponent(getAuthToken());
    const source = new EventSource(apiUrl(`/api/orders/stream?token=${token}`));
    source.addEventListener("orders", (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; tableNumber?: number };
        if (payload.type === "created") playVoiceNotification(Number(payload.tableNumber));
      } catch {
        /* ignore malformed payloads */
      }
      void loadOrders();
      void loadTables();
    });
    source.addEventListener("calls", (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type === "created" || payload.type === "repeated") playStaffAlert();
      } catch {
        /* ignore malformed payloads */
      }
      void loadCalls();
      void loadTables();
    });
    source.addEventListener("tables", () => {
      void loadTables();
    });
    const poll = window.setInterval(() => {
      void loadOrders({ detectNew: true });
      void loadCalls({ detectNew: true });
      void loadTables();
    }, 8000);
    return () => {
      source.close();
      window.clearInterval(poll);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const pendingCalls = calls.filter((call) => call.status === "pending");

  async function completeOrder(id: string) {
    try {
      await api.completeOrder(id);
      await loadOrders();
      setMessage("ໝາຍວ່າສຳເລັດແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ອັບເດດອໍເດີບໍ່ສຳເລັດ.");
    }
  }

  async function resolveCall(id: string) {
    try {
      await api.resolveCall(id);
      await loadCalls();
      setMessage("ຮັບຄຳຮ້ອງຂໍແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ອັບເດດຄຳຮ້ອງຂໍບໍ່ສຳເລັດ.");
    }
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditForm({
      name: product.name,
      price: product.price,
      image: product.image,
      description: product.description,
      categoryId: product.categoryId,
      available: product.available,
    });
    setTab("menu");
  }

  function closeEdit() {
    setEditingId(null);
    setEditForm({
      ...emptyForm,
      categoryId: categories[0]?.id || "",
      available: true,
    });
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id || "",
      available: true,
    });
  }

  useEffect(() => {
    if (!editingId && !deletingProduct && !soundSettingsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (soundSettingsOpen) {
        setSoundSettingsOpen(false);
        return;
      }
      if (deletingProduct) {
        setDeletingProduct(null);
        return;
      }
      closeEdit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, deletingProduct, soundSettingsOpen]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setShopNameDraft(shop.name);
    setShopLogoDraft(shop.logo);
  }, [shop]);

  async function saveShopSettings(event: FormEvent) {
    event.preventDefault();
    const name = shopNameDraft.trim();
    if (!name) {
      setError("ກະລຸນາໃສ່ຊື່ຮ້ານ.");
      return;
    }
    setSavingShop(true);
    setError("");
    try {
      const updated = await api.updateShop({ name, logo: shopLogoDraft.trim() });
      setShop(updated);
      setMessage("ບັນທຶກຂໍ້ມູນຮ້ານແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກຂໍ້ມູນຮ້ານບໍ່ສຳເລັດ.");
    } finally {
      setSavingShop(false);
    }
  }

  function toggleOrderSound() {
    unlockOrderSound();
    const next = !soundEnabled;
    setOrderSoundEnabled(next);
    setSoundEnabled(next);
    if (next) playVoiceNotification(1);
  }

  function openSoundSettings() {
    unlockOrderSound();
    setVoiceRateDraft(getVoiceRate());
    setVoicePitchDraft(getVoicePitch());
    setSoundSettingsOpen(true);
  }

  function saveSoundSettings() {
    setVoiceRate(voiceRateDraft || DEFAULT_VOICE_RATE);
    setVoicePitch(voicePitchDraft || DEFAULT_VOICE_PITCH);
    setSoundSettingsOpen(false);
    setMessage("ບັນທຶກສຽງແຈ້ງເຕືອນແລ້ວ.");
    if (soundEnabled) {
      previewVoiceNotification(1, {
        rate: voiceRateDraft,
        pitch: voicePitchDraft,
      });
    }
  }

  async function saveProduct(e: FormEvent, mode: "add" | "edit") {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = mode === "edit" ? editForm : form;
    try {
      if (mode === "edit" && editingId) await api.updateProduct(editingId, payload);
      else await api.createProduct(payload);
      if (mode === "edit") closeEdit();
      else resetForm();
      await loadMenu();
      setMessage(mode === "edit" ? "ອັບເດດເມນູແລ້ວ." : "ເພີ່ມເມນູໃໝ່ແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກເມນູບໍ່ສຳເລັດ.");
    } finally {
      setSaving(false);
    }
  }

  function openAddCategory() {
    setCategoryEditor("add");
    setCategoryDraft("");
    setCategoryEditId("");
  }

  function openEditCategory() {
    const current = categories.find((category) => category.id === form.categoryId) ?? categories[0];
    setCategoryEditor("edit");
    setCategoryEditId(current?.id || "");
    setCategoryDraft(current?.name || "");
  }

  function cancelCategoryEditor() {
    setCategoryEditor("idle");
    setCategoryDraft("");
    setCategoryEditId("");
  }

  async function saveCategory() {
    const name = categoryDraft.trim();
    if (!name) {
      setError("ກະລຸນາໃສ່ຊື່ໝວດໝູ່.");
      return;
    }
    setSavingCategory(true);
    setError("");
    try {
      if (categoryEditor === "add") {
        const created = await api.createCategory({ name });
        await loadMenu();
        setForm((current) => ({ ...current, categoryId: created.id }));
        setMessage("ເພີ່ມໝວດໝູ່ແລ້ວ.");
      } else {
        if (!categoryEditId) {
          setError("ກະລຸນາເລືອກໝວດໝູ່.");
          return;
        }
        const updated = await api.updateCategory(categoryEditId, { name });
        await loadMenu();
        setForm((current) =>
          current.categoryId === updated.id ? { ...current, categoryId: updated.id } : current,
        );
        setMessage("ອັບເດດໝວດໝູ່ແລ້ວ.");
      }
      cancelCategoryEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ບັນທຶກໝວດໝູ່ບໍ່ສຳເລັດ.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function toggleAvailable(product: Product) {
    await api.patchProduct(product.id, { available: !product.available });
    await loadMenu();
  }

  async function confirmRemoveProduct() {
    if (!deletingProduct) return;
    setDeleting(true);
    setError("");
    try {
      await api.deleteProduct(deletingProduct.id);
      setDeletingProduct(null);
      await loadMenu();
      setMessage("ລຶບເມນູແລ້ວ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ລຶບເມນູບໍ່ສຳເລັດ.");
    } finally {
      setDeleting(false);
    }
  }

  const groupedProducts = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    return categories
      .filter((category) => menuFilter === "all" || category.id === menuFilter)
      .map((category) => ({
        category,
        items: products.filter((product) => {
          if (product.categoryId !== category.id) return false;
          if (!q) return true;
          return `${product.name} ${product.description}`.toLowerCase().includes(q);
        }),
      }))
      .filter((group) => group.items.length > 0 || (!q && menuFilter !== "all"));
  }, [categories, products, menuQuery, menuFilter]);

  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "completed"),
    [orders],
  );

  const reportRange = useMemo(() => {
    const now = new Date();
    if (reportPreset === "today") {
      return { start: startOfLocalDay(now), end: endOfLocalDay(now) };
    }
    if (reportPreset === "yesterday") {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return { start: startOfLocalDay(yesterday), end: endOfLocalDay(yesterday) };
    }
    if (reportPreset === "last7") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      return { start: startOfLocalDay(start), end: endOfLocalDay(now) };
    }
    if (reportPreset === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { start, end };
    }
    const from = parseDateInput(appliedFrom);
    const to = parseDateInput(appliedTo);
    if (!from || !to) return null;
    const first = from.getTime() <= to.getTime() ? from : to;
    const last = from.getTime() <= to.getTime() ? to : from;
    return { start: startOfLocalDay(first), end: endOfLocalDay(last) };
  }, [reportPreset, appliedFrom, appliedTo]);

  const filteredOrders = useMemo(() => {
    if (!reportRange) return [];
    return completedOrders.filter((order) => isInLocalRange(order.createdAt, reportRange.start, reportRange.end));
  }, [completedOrders, reportRange]);

  const filteredRevenue = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + order.total, 0),
    [filteredOrders],
  );

  const listedOrders = useMemo(() => {
    if (historyQuery.trim()) {
      return completedOrders.filter((order) => matchesOrderSearch(order, historyQuery));
    }
    return filteredOrders;
  }, [completedOrders, filteredOrders, historyQuery]);

  const reportLabel =
    reportPreset === "today"
      ? "ມື້ນີ້"
      : reportPreset === "yesterday"
        ? "ມື້ວານ"
        : reportPreset === "last7"
          ? "7 ວັນ"
          : reportPreset === "month"
            ? "ເດືອນນີ້"
            : `${toDisplayDate(appliedFrom)} → ${toDisplayDate(appliedTo)}`;

  function applyPreset(value: ReportPreset) {
    setFilterError("");
    setReportPreset(value);
    const now = new Date();
    if (value === "today") {
      const today = toDateInputValue(now);
      setFromInput(today);
      setToInput(today);
      return;
    }
    if (value === "yesterday") {
      const yesterday = toDateInputValue(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      );
      setFromInput(yesterday);
      setToInput(yesterday);
      return;
    }
    if (value === "last7") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setFromInput(toDateInputValue(start));
      setToInput(toDateInputValue(now));
      return;
    }
    if (value === "month") {
      setFromInput(toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToInput(toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }
  }

  function applyCustomRange() {
    const from = parseDateInput(fromInput);
    const to = parseDateInput(toInput);
    if (!from || !to) {
      setFilterError("ກະລຸນາເລືອກວັນທີໃຫ້ຄົບ.");
      return;
    }
    setFilterError("");
    if (from.getTime() <= to.getTime()) {
      setAppliedFrom(fromInput);
      setAppliedTo(toInput);
    } else {
      setAppliedFrom(toInput);
      setAppliedTo(fromInput);
      setFromInput(toInput);
      setToInput(fromInput);
    }
    setReportPreset("custom");
  }

  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="border-b border-orange-100 bg-[#fff7ed] text-stone-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <ShopBrand
              nameClassName="text-xs font-semibold text-stone-800"
              logoClassName="h-9 w-9 rounded-full object-cover bg-white"
            />
            <h1 className="font-display text-2xl text-stone-900">ແຜງຄວບຄຸມຮ້ານ</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-800">
              ເບິ່ງເມນູລູກຄ້າ
            </Link>
            <button
              type="button"
              onClick={() => {
                logoutAdmin();
                navigate("/admin/login", { replace: true });
              }}
              className="rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-800"
            >
              ອອກຈາກລະບົບ
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
              ອໍເດີ {pendingCount > 0 && <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">{pendingCount}</span>}
            </TabButton>
            <TabButton active={tab === "calls"} onClick={() => setTab("calls")}>
              ເອີ້ນພະນັກງານ {pendingCalls.length > 0 && <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white">{pendingCalls.length}</span>}
            </TabButton>
            <TabButton active={tab === "tables"} onClick={() => setTab("tables")}>
              ໂຕະ
            </TabButton>
            <TabButton active={tab === "reports"} onClick={() => setTab("reports")}>
              ປະຫວັດ ແລະ ສະຖິຕິ
            </TabButton>
            <TabButton active={tab === "menu"} onClick={() => setTab("menu")}>
              ເມນູ
            </TabButton>
            <TabButton active={tab === "staff"} onClick={() => setTab("staff")}>
              ພະນັກງານ
            </TabButton>
            <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
              ຕັ້ງຄ່າຮ້ານ
            </TabButton>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleOrderSound}
              title={soundEnabled ? "ປິດສຽງແຈ້ງເຕືອນ" : "ເປີດສຽງແຈ້ງເຕືອນ"}
              aria-label={soundEnabled ? "ປິດສຽງແຈ້ງເຕືອນ" : "ເປີດສຽງແຈ້ງເຕືອນ"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-lg text-stone-800"
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
            <button
              type="button"
              onClick={openSoundSettings}
              title="ຕັ້ງຄ່າສຽງແຈ້ງເຕືອນ"
              aria-label="ຕັ້ງຄ່າສຽງແຈ້ງເຕືອນ"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-sm font-semibold text-stone-800"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-6"
          role="status"
          aria-live="polite"
          onClick={() => setMessage("")}
        >
          <div
            className="max-w-sm rounded-3xl bg-white px-8 py-7 text-center shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-4xl">✅</p>
            <p className="font-display mt-3 text-xl text-stone-900">{message}</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-red-700">{error}</p>}
        {pendingCalls.length > 0 && tab !== "calls" && (
          <button
            type="button"
            onClick={() => setTab("calls")}
            className="mb-4 w-full rounded-2xl bg-orange-600 px-4 py-3 text-left font-semibold text-white"
          >
            🔔 ໂຕະ {pendingCalls[0]?.tableNumber} ກຳລັງເອີ້ນ: {pendingCalls[0] ? staffCallLabel(pendingCalls[0]) : ""}
            {pendingCalls.length > 1 ? ` · +${pendingCalls.length - 1}` : ""}
          </button>
        )}
        {loading && <p className="text-stone-500">ກຳລັງໂຫຼດ...</p>}

        {tab === "orders" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-stone-900">ອໍເດີທີ່ຫາກໍ່ສັ່ງ</h2>
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium"
              >
                ໂຫຼດໃໝ່
              </button>
            </div>
            {orders.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີອໍເດີ.</p>}
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} shop={shop} onComplete={(id) => void completeOrder(id)} />
              ))}
            </div>
          </section>
        )}

        {tab === "calls" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-stone-900">ຄຳຮ້ອງຂໍຈາກລູກຄ້າ</h2>
              <button
                type="button"
                onClick={() => void loadCalls()}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium"
              >
                ໂຫຼດໃໝ່
              </button>
            </div>
            {calls.length === 0 && <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ຍັງບໍ່ມີຄຳຮ້ອງຂໍ.</p>}
            <div className="space-y-4">
              {calls.map((call) => (
                <article
                  key={call.id}
                  className={`rounded-3xl bg-white p-5 shadow-sm ${call.status === "pending" ? "ring-2 ring-orange-400" : "opacity-75"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-2xl text-stone-900">ໂຕະ {call.tableNumber}</p>
                        {staffCallTimes(call) > 1 && (
                          <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-sm font-bold text-white">
                            {staffCallTimes(call)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-lg font-semibold text-orange-700">{staffCallLabel(call)}</p>
                      <p className="text-sm text-stone-500">{formatTime(staffCallWhen(call))}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
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
                      className="mt-4 rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white"
                    >
                      ຮັບແລ້ວ
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "tables" && (
          <TableBoard canAdd tables={tables} adding={addingTable} onAdd={addTable} onAction={setTableStatus} onTransfer={transferTable} onDelete={removeTable} />
        )}

        {tab === "reports" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-stone-900">ປະຫວັດ ແລະ ສະຖິຕິ</h2>
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium"
              >
                ໂຫຼດໃໝ່
              </button>
            </div>

            <div className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-medium text-stone-600">
                  ໄລຍະເວລາ
                  <select
                    value={reportPreset}
                    onChange={(e) => applyPreset(e.target.value as ReportPreset)}
                    className="mt-1 block min-w-44 rounded-xl border border-stone-200 bg-white px-3 py-2"
                  >
                    <option value="today">ມື້ນີ້</option>
                    <option value="yesterday">ມື້ວານ</option>
                    <option value="last7">7 ວັນ</option>
                    <option value="month">ເດືອນນີ້</option>
                    <option value="custom">ກຳນົດເອງ</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-stone-600">
                  ຈາກວັນທີ
                  <DateInput value={fromInput} onChange={setFromInput} />
                </label>
                <label className="text-sm font-medium text-stone-600">
                  ເຖິງວັນທີ
                  <DateInput value={toInput} onChange={setToInput} />
                </label>
                <button
                  type="button"
                  onClick={applyCustomRange}
                  className="rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  ຄົ້ນຫາ
                </button>
              </div>
              {filterError && <p className="mt-2 text-sm text-red-600">{filterError}</p>}
            </div>

            <article className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">ຍອດຂາຍ · {reportLabel}</p>
              <p className="font-display mt-2 text-3xl text-orange-700">{formatVnd(filteredRevenue)}</p>
              <p className="mt-1 text-xs text-stone-400">{filteredOrders.length} ອໍເດີສຳເລັດ</p>
            </article>

            <h3 className="font-display mb-3 text-lg text-stone-900">ປະຫວັດອໍເດີສຳເລັດ</h3>
            <label className="relative mb-4 block">
              <span className="sr-only">ຄົ້ນຫາອໍເດີ</span>
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
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="ຄົ້ນຫາລະຫັດອໍເດີ, ເລກໂຕະ, ວັນທີ..."
                className="w-full rounded-2xl border border-stone-200 bg-white py-3 pr-4 pl-10 text-sm outline-none focus:border-orange-500"
              />
            </label>
            {listedOrders.length === 0 && (
              <p className="rounded-3xl bg-white p-8 text-center text-stone-500">
                {historyQuery.trim() ? "ບໍ່ພົບອໍເດີທີ່ຄົ້ນຫາ." : "ບໍ່ມີອໍເດີສຳເລັດໃນຊ່ວງນີ້."}
              </p>
            )}
            <div className="space-y-4">
              {listedOrders.map((order) => (
                <OrderCard key={order.id} order={order} shop={shop} />
              ))}
            </div>
          </section>
        )}

        {tab === "menu" && (
          <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <form id="product-form" onSubmit={(e) => void saveProduct(e, "add")} className="h-fit rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-display text-xl">ເພີ່ມເມນູໃໝ່</h2>
              <label className="mt-4 block text-sm font-medium">
                ຊື່ອາຫານ
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="mt-3 block text-sm font-medium">
                ລາຄາ (ກີບ)
                <input
                  required
                  type="number"
                  min={0}
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">ໝວດໝູ່</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={openAddCategory}
                      className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
                    >
                      ເພີ່ມ
                    </button>
                    <button
                      type="button"
                      onClick={openEditCategory}
                      disabled={categories.length === 0}
                      className="rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      ແກ້ໄຂ
                    </button>
                  </div>
                </div>
                {categoryEditor !== "idle" && (
                  <div className="mt-2 rounded-2xl border border-orange-200 bg-orange-50 p-3">
                    <p className="text-sm font-semibold text-orange-800">
                      {categoryEditor === "add" ? "ເພີ່ມໝວດໝູ່ໃໝ່" : "ແກ້ໄຂໝວດໝູ່"}
                    </p>
                    {categoryEditor === "edit" && (
                      <select
                        value={categoryEditId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setCategoryEditId(id);
                          setCategoryDraft(categories.find((category) => category.id === id)?.name || "");
                        }}
                        className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      value={categoryDraft}
                      onChange={(e) => setCategoryDraft(e.target.value)}
                      placeholder="ຊື່ໝວດໝູ່"
                      className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={savingCategory}
                        onClick={() => void saveCategory()}
                        className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        {savingCategory ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
                      </button>
                      <button type="button" onClick={cancelCategoryEditor} className="rounded-xl bg-white px-3 py-2 text-sm">
                        ຍົກເລີກ
                      </button>
                    </div>
                  </div>
                )}
                <select
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="mt-3 block text-sm font-medium">
                ຮູບອາຫານ
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-orange-700"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    setError("");
                    void api
                      .uploadImage(file)
                      .then((url) => setForm((current) => ({ ...current, image: url })))
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ.");
                      })
                      .finally(() => setUploading(false));
                  }}
                />
              </label>
              {form.image && (
                <img src={form.image} alt="" className="mt-2 h-24 w-24 rounded-2xl object-cover" onError={onImgError} />
              )}
              <label className="mt-3 block text-sm font-medium">
                ຫຼືວາງ URL ຮູບ
                <input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              {uploading && <p className="mt-2 text-sm text-stone-500">ກຳລັງອັບໂຫຼດຮູບ...</p>}
              <label className="mt-3 block text-sm font-medium">
                ລາຍລະອຽດ
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                />
                ຍັງມີ / ສະແດງໃນເມນູ
              </label>
              <div className="mt-4 flex gap-2">
                <button disabled={saving || uploading} className="flex-1 rounded-2xl bg-orange-600 py-3 font-semibold text-white">
                  {saving && !editingId ? "ກຳລັງບັນທຶກ..." : "ເພີ່ມເມນູ"}
                </button>
              </div>
            </form>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-4 shadow-sm">
                <label className="block text-sm font-medium">
                  ຄົ້ນຫາເມນູ
                  <input
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    placeholder="ຄົ້ນຫາຊື່ອາຫານ..."
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="mt-3 block text-sm font-medium">
                  ໝວດໝູ່
                  <select
                    value={menuFilter}
                    onChange={(e) => setMenuFilter(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                  >
                    <option value="all">ທັງໝົດ</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {groupedProducts.length === 0 && (
                <p className="rounded-3xl bg-white p-8 text-center text-stone-500">ບໍ່ພົບລາຍການ.</p>
              )}
              {groupedProducts.map(({ category, items }) => (
                <div key={category.id}>
                  <h3 className="font-display mb-3 text-lg">{category.name}</h3>
                  <div className="space-y-3">
                    {items.map((product) => (
                      <article key={product.id} className="flex gap-3 rounded-3xl bg-white p-3 shadow-sm">
                        <img src={product.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" onError={onImgError} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{product.name}</p>
                              <p className="text-sm text-orange-700">{formatVnd(product.price)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                  product.available ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"
                                }`}
                              >
                                {product.available ? "ກຳລັງຂາຍ" : "ໝົດ / ເຊື່ອງ"}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEdit(product)}
                                className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
                              >
                                ແກ້ໄຂ
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingProduct(product)}
                                className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                              >
                                ລຶບ
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            <button type="button" className="text-stone-600" onClick={() => void toggleAvailable(product)}>
                              {product.available ? "ເຊື່ອງເມນູ" : "ສະແດງເມນູ"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "staff" && <StaffAccountsBoard onMessage={setMessage} onError={setError} />}

        {tab === "settings" && (
          <section className="mx-auto max-w-lg">
            <form onSubmit={(event) => void saveShopSettings(event)} className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="font-display text-xl text-stone-900">ຕັ້ງຄ່າຮ້ານ</h2>
              <p className="mt-1 text-sm text-stone-500">ຊື່ ແລະ ໂລໂກ້ຈະສະແດງໃນໜ້າລູກຄ້າ ແລະ ໜ້າຈັດການ.</p>
              <label className="mt-5 block text-sm font-medium">
                ຊື່ຮ້ານ
                <input
                  required
                  maxLength={80}
                  value={shopNameDraft}
                  onChange={(event) => setShopNameDraft(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                ໂລໂກ້
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-orange-700"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setUploadingLogo(true);
                    setError("");
                    void api
                      .uploadImage(file)
                      .then((url) => setShopLogoDraft(url))
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ.");
                      })
                      .finally(() => setUploadingLogo(false));
                  }}
                />
              </label>
              {shopLogoDraft ? (
                <div className="mt-3 flex items-center gap-3">
                  <img
                    src={shopLogoDraft}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover"
                    onError={onImgError}
                  />
                  <button
                    type="button"
                    onClick={() => setShopLogoDraft("")}
                    className="text-sm text-red-600"
                  >
                    ລຶບໂລໂກ້
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-stone-400">ຍັງບໍ່ມີໂລໂກ້.</p>
              )}
              {uploadingLogo && <p className="mt-2 text-sm text-stone-500">ກຳລັງອັບໂຫຼດຮູບ...</p>}
              <button
                type="submit"
                disabled={savingShop || uploadingLogo}
                className="mt-5 w-full rounded-2xl bg-orange-600 py-3 font-semibold text-white"
              >
                {savingShop ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
              </button>
            </form>
          </section>
        )}
        {editingId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={closeEdit}
            role="presentation"
          >
            <form
              onSubmit={(e) => void saveProduct(e, "edit")}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="font-display text-xl">ແກ້ໄຂເມນູ</h2>
                <button type="button" onClick={closeEdit} className="rounded-full bg-stone-100 px-3 py-1 text-sm">
                  ປິດ
                </button>
              </div>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <label className="mt-3 block text-sm font-medium">
                ຊື່ອາຫານ
                <input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="mt-3 block text-sm font-medium">
                ລາຄາ (ກີບ)
                <input
                  required
                  type="number"
                  min={0}
                  value={editForm.price || ""}
                  onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="mt-3 block text-sm font-medium">
                ໝວດໝູ່
                <select
                  required
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium">
                ຮູບອາຫານ
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1 file:text-orange-700"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    setError("");
                    void api
                      .uploadImage(file)
                      .then((url) => setEditForm((current) => ({ ...current, image: url })))
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ.");
                      })
                      .finally(() => setUploading(false));
                  }}
                />
              </label>
              {editForm.image && (
                <img src={editForm.image} alt="" className="mt-2 h-24 w-24 rounded-2xl object-cover" onError={onImgError} />
              )}
              <label className="mt-3 block text-sm font-medium">
                ຫຼືວາງ URL ຮູບ
                <input
                  value={editForm.image}
                  onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              {uploading && <p className="mt-2 text-sm text-stone-500">ກຳລັງອັບໂຫຼດຮູບ...</p>}
              <label className="mt-3 block text-sm font-medium">
                ລາຍລະອຽດ
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.available}
                  onChange={(e) => setEditForm({ ...editForm, available: e.target.checked })}
                />
                ຍັງມີ / ສະແດງໃນເມນູ
              </label>
              <div className="mt-4 flex gap-2">
                <button disabled={saving || uploading} className="flex-1 rounded-2xl bg-orange-600 py-3 font-semibold text-white">
                  {saving ? "ກຳລັງບັນທຶກ..." : "ອັບເດດ"}
                </button>
                <button type="button" onClick={closeEdit} className="rounded-2xl bg-stone-100 px-4">
                  ຍົກເລີກ
                </button>
              </div>
            </form>
          </div>
        )}
        {deletingProduct && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDeletingProduct(null)}
            role="presentation"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
            >
              <h2 className="font-display text-xl">ລຶບເມນູ</h2>
              <p className="mt-3 text-stone-700">ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບເມນູນີ້?</p>
              <p className="mt-1 font-semibold text-stone-900">{deletingProduct.name}</p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void confirmRemoveProduct()}
                  className="flex-1 rounded-2xl bg-red-600 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {deleting ? "ກຳລັງລຶບ..." : "ຢືນຢັນ"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeletingProduct(null)}
                  className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-800"
                >
                  ຍົກເລີກ
                </button>
              </div>
            </div>
          </div>
        )}

        {soundSettingsOpen && (
          <div
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSoundSettingsOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-stone-900">ແຈ້ງເຕືອນດ້ວຍສຽງເວົ້າ</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    ເມື່ອມີອໍເດີໃໝ່ ລະບົບຈະອ່ານວ່າມີອໍເດີໃໝ່ຈາກໂຕະໃດ.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="ປິດ"
                  onClick={() => setSoundSettingsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-lg"
                >
                  ×
                </button>
              </div>

              <p className="mt-4 rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
                ຕົວຢ່າງ: {buildVoiceMessage(1)}
              </p>
              {!findThaiVoice() && (
                <p className="mt-2 text-xs text-orange-700">ເຄື່ອງນີ້ຍັງບໍ່ພົບສຽງພາສາໄທ. ກະລຸນາຕິດຕັ້ງສຽງໄທໃນລະບົບ.</p>
              )}

              <label className="mt-4 block text-sm font-medium text-stone-700">
                ຄວາມໄວອ່ານ ({voiceRateDraft.toFixed(2)})
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={voiceRateDraft}
                  onChange={(event) => setVoiceRateDraft(Number(event.target.value))}
                  className="mt-2 w-full accent-orange-600"
                />
              </label>
              <label className="mt-3 block text-sm font-medium text-stone-700">
                ລະດັບສຽງ ({voicePitchDraft.toFixed(2)})
                <input
                  type="range"
                  min="0.7"
                  max="1.3"
                  step="0.05"
                  value={voicePitchDraft}
                  onChange={(event) => setVoicePitchDraft(Number(event.target.value))}
                  className="mt-2 w-full accent-orange-600"
                />
              </label>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    previewVoiceNotification(1, {
                      rate: voiceRateDraft,
                      pitch: voicePitchDraft,
                    })
                  }
                  className="flex-1 rounded-2xl bg-stone-100 py-3 font-semibold text-stone-800"
                >
                  ຫຼິ້ນທົດລອງ
                </button>
                <button
                  type="button"
                  onClick={saveSoundSettings}
                  className="flex-1 rounded-2xl bg-orange-600 py-3 font-semibold text-white"
                >
                  ບັນທຶກ
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({
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
      className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-orange-600 text-white [&_span]:bg-white [&_span]:text-orange-700"
          : "text-stone-600 hover:bg-orange-50 hover:text-orange-800"
      }`}
    >
      {children}
    </button>
  );
}
