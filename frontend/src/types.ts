export type OrderStatus = "pending" | "completed";

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  categoryId: string;
  available: boolean;
}

export interface Shop {
  id: string;
  name: string;
  logo: string;
  updatedAt: string;
}

export interface MenuResponse {
  categories: Category[];
  products: Product[];
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

export interface Order {
  id: string;
  code: string;
  tableNumber: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  note: string;
}

export interface ProductInput {
  name: string;
  price: number;
  image: string;
  description: string;
  categoryId: string;
  available: boolean;
}

export type StaffCallReason = "payment" | "refill" | "other";
export type StaffCallStatus = "pending" | "done";
export type TableOccupancy = "empty" | "busy" | "locked";
export type TableAction = "open" | "close" | "lock" | "unlock";
export type GuestTableStatus = "locked" | "empty" | "occupied";

export interface DiningTable {
  id: string;
  number: number;
  status: TableOccupancy;
  occupied: boolean;
  locked: boolean;
  occupiedAt: string | null;
  hasOrder: boolean;
  hasCall: boolean;
  createdAt: string;
}

export interface PublicTableStatus {
  number: number;
  status: GuestTableStatus;
  canOrder: boolean;
  canCall: boolean;
}

export interface StaffAccount {
  id: string;
  username: string;
  name: string;
  role: "staff";
  createdAt: string;
  mustChangePassword?: boolean;
}

export interface StaffCall {
  id: string;
  tableNumber: number;
  reason: StaffCallReason;
  message: string;
  status: StaffCallStatus;
  times: number;
  createdAt: string;
  updatedAt: string;
}

export type SongRequestStatus = "pending" | "approved" | "rejected";

export interface SongRequest {
  id: string;
  tableNumber: number;
  title: string;
  status: SongRequestStatus;
  createdAt: string;
  updatedAt: string;
}
