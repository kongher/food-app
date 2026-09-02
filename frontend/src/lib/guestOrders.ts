import type { Order } from "../types";

type GuestOrderStore = {
  sessionId: string;
  orders: Order[];
};

function storageKey(table: number): string {
  return `food-app-guest-orders:${table}`;
}

function readStore(table: number): GuestOrderStore | null {
  try {
    const raw = localStorage.getItem(storageKey(table));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestOrderStore | Order[];
    if (Array.isArray(parsed)) return null;
    if (!parsed || typeof parsed.sessionId !== "string" || !Array.isArray(parsed.orders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGuestOrders(table: number): void {
  localStorage.removeItem(storageKey(table));
}

export function loadGuestOrders(table: number, sessionId: string | null): Order[] {
  if (!sessionId) {
    clearGuestOrders(table);
    return [];
  }
  const stored = readStore(table);
  if (!stored || stored.sessionId !== sessionId) {
    clearGuestOrders(table);
    return [];
  }
  return stored.orders;
}

export function saveGuestOrders(table: number, sessionId: string, orders: Order[]): void {
  localStorage.setItem(
    storageKey(table),
    JSON.stringify({ sessionId, orders: orders.slice(0, 40) } satisfies GuestOrderStore),
  );
}
