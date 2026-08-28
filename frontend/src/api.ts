import type {
  Category,
  DiningTable,
  MenuResponse,
  Order,
  Product,
  ProductInput,
  Shop,
  StaffAccount,
  StaffCall,
  StaffCallReason,
} from "./types";
import { getAuthToken } from "./lib/session";

export type LoginResponse = {
  token: string;
  role: "admin" | "staff";
  username: string;
};

function authHeaders(json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...authHeaders(!(init?.body instanceof FormData)),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "ເຊື່ອມຕໍ່ເຊີບເວີບໍ່ສຳເລັດ.");
  }
  return data;
}

export const api = {
  login: (body: { username: string; password: string }) =>
    request<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  uploadImage: async (file: File): Promise<string> => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body, headers: authHeaders(false) });
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
  completeOrder: (id: string) =>
    request<Order>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
  getCalls: () => request<StaffCall[]>("/api/calls"),
  createCall: (body: { tableNumber: number; reason: StaffCallReason }) =>
    request<StaffCall>("/api/calls", { method: "POST", body: JSON.stringify(body) }),
  resolveCall: (id: string) =>
    request<StaffCall>(`/api/calls/${id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) }),
  getShop: () => request<Shop>("/api/shop"),
  updateShop: (body: { name: string; logo: string }) =>
    request<Shop>("/api/shop", { method: "PUT", body: JSON.stringify(body) }),
  getTables: () => request<DiningTable[]>("/api/tables"),
  createTable: (body: { number: number }) =>
    request<DiningTable>("/api/tables", { method: "POST", body: JSON.stringify(body) }),
  deleteTable: (id: string) => request<void>(`/api/tables/${id}`, { method: "DELETE" }),
  clearTable: (id: string) =>
    request<DiningTable>(`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify({ occupied: false }) }),
  getStaff: () => request<StaffAccount[]>("/api/staff"),
  createStaff: (body: { name: string; username: string; password: string }) =>
    request<StaffAccount>("/api/staff", { method: "POST", body: JSON.stringify(body) }),
  updateStaff: (id: string, body: { name: string; username: string; password?: string }) =>
    request<StaffAccount>(`/api/staff/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteStaff: (id: string) => request<void>(`/api/staff/${id}`, { method: "DELETE" }),
};
