import type {
  Category,
  DiningTable,
  MenuResponse,
  Order,
  Product,
  ProductInput,
  Promotion,
  PromotionInput,
  PublicTableStatus,
  Shop,
  StaffAccount,
  StaffCall,
  StaffCallReason,
  TableAction,
  TableActionOptions,
  SongRequest,
  SongRequestStatus,
} from "./types";
import { clearSession, getAuthToken, getSession, saveSession } from "./lib/session";

export type LoginResponse = {
  token: string;
  role: "admin" | "staff";
  username: string;
  mustChangePassword?: boolean;
};

export type AuthMeResponse = {
  id: string;
  username: string;
  role: "admin" | "staff";
  mustChangePassword: boolean;
};

const RENDER_API = "https://food-app-dg0b.onrender.com";

export function getApiBase(): string {
  const configured = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (import.meta.env.DEV) return "";
  if (typeof window === "undefined") return RENDER_API;
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return RENDER_API;
  if (hostname === "food-app-dg0b.onrender.com") return "";
  return RENDER_API;
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  if (!base || path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeaders(json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...authHeaders(!(init?.body instanceof FormData)),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => ({}))) as T & { error?: string; mustChangePassword?: boolean };
  if (!response.ok) {
    if (data.mustChangePassword) {
      const session = getSession();
      if (session) saveSession({ ...session, mustChangePassword: true });
    } else if (response.status === 401 && getAuthToken() && !path.includes("/auth/login")) {
      expireExpiredSession();
    }
    throw new Error(data.error || "ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ສຳເລັດ.");
  }
  return data;
}

function expireExpiredSession(): void {
  const path = window.location.pathname;
  clearSession();
  if (path.startsWith("/staff")) {
    window.location.assign("/staff/login");
    return;
  }
  if (path.startsWith("/admin")) {
    window.location.assign("/admin/login");
  }
}

export const api = {
  login: (body: { username: string; password: string }) =>
    request<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  getMe: () => request<AuthMeResponse>("/api/auth/me"),
  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<LoginResponse>("/api/auth/change-password", { method: "POST", body: JSON.stringify(body) }),
  uploadImage: async (file: File): Promise<string> => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(apiUrl("/api/uploads"), { method: "POST", body, headers: authHeaders(false) });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      throw new Error(data.error || "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ.");
    }
    return data.url;
  },
  getMenu: () => request<MenuResponse>("/api/menu"),
  getCategories: () => request<Category[]>("/api/categories"),
  createCategory: (body: { name: string }) =>
    request<Category>("/api/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (id: string, body: { name: string }) =>
    request<Category>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  getProducts: () => request<Product[]>("/api/products"),
  createProduct: (body: ProductInput) =>
    request<Product>("/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: ProductInput) =>
    request<Product>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  patchProduct: (id: string, body: Partial<ProductInput>) =>
    request<Product>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: string) => request<void>(`/api/products/${id}`, { method: "DELETE" }),
  getOrders: () => request<Order[]>("/api/orders"),
  createOrder: (body: { tableNumber: number; items: { productId: string; quantity: number; note?: string }[] }) =>
    request<Order>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  updateOrderItems: (id: string, items: { productId: string; quantity: number; note?: string }[]) =>
    request<Order>(`/api/orders/${id}/items`, { method: "PUT", body: JSON.stringify({ items }) }),
  completeOrder: (id: string) =>
    request<Order>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
  deleteOrder: (id: string) => request<void>(`/api/orders/${id}`, { method: "DELETE" }),
  getCalls: () => request<StaffCall[]>("/api/calls"),
  createCall: (body: { tableNumber: number; reason: StaffCallReason }) =>
    request<StaffCall>("/api/calls", { method: "POST", body: JSON.stringify(body) }),
  resolveCall: (id: string) =>
    request<StaffCall>(`/api/calls/${id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) }),
  getSongs: (tableNumber?: number) =>
    request<SongRequest[]>(`/api/songs${tableNumber ? `?tableNumber=${tableNumber}` : ""}`),
  createSong: (body: { tableNumber: number; title: string }) =>
    request<SongRequest>("/api/songs", { method: "POST", body: JSON.stringify(body) }),
  setSongStatus: (id: string, status: SongRequestStatus) =>
    request<SongRequest>(`/api/songs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteSong: (id: string) => request<void>(`/api/songs/${id}`, { method: "DELETE" }),
  getShop: () => request<Shop>("/api/shop"),
  updateShop: (body: { name: string; logo: string }) =>
    request<Shop>("/api/shop", { method: "PUT", body: JSON.stringify(body) }),
  getTables: () => request<DiningTable[]>("/api/tables"),
  getTableStatus: (tableNumber: number) => request<PublicTableStatus>(`/api/tables/status/${tableNumber}`),
  createTable: (body: { number: number }) =>
    request<DiningTable>("/api/tables", { method: "POST", body: JSON.stringify(body) }),
  deleteTable: (id: string) => request<void>(`/api/tables/${id}`, { method: "DELETE" }),
  setTableAction: (id: string, action: TableAction, extra?: TableActionOptions) =>
    request<DiningTable>(`/api/tables/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action, ...extra }),
    }),
  transferTable: (id: string, toNumber: number) =>
    request<{ from: DiningTable; to: DiningTable }>(`/api/tables/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ toNumber }),
    }),
  getStaff: () => request<StaffAccount[]>("/api/staff"),
  createStaff: (body: { name: string; username: string }) =>
    request<StaffAccount>("/api/staff", { method: "POST", body: JSON.stringify(body) }),
  updateStaff: (id: string, body: { name: string; username: string; password?: string }) =>
    request<StaffAccount>(`/api/staff/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteStaff: (id: string) => request<void>(`/api/staff/${id}`, { method: "DELETE" }),
  getPromotions: () => request<Promotion[]>("/api/promotions"),
  getAllPromotions: () => request<Promotion[]>("/api/promotions/all"),
  createPromotion: (body: PromotionInput) =>
    request<Promotion>("/api/promotions", { method: "POST", body: JSON.stringify(body) }),
  updatePromotion: (id: string, body: PromotionInput) =>
    request<Promotion>(`/api/promotions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setPromotionActive: (id: string, active: boolean) =>
    request<Promotion>(`/api/promotions/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  deletePromotion: (id: string) => request<void>(`/api/promotions/${id}`, { method: "DELETE" }),
};
