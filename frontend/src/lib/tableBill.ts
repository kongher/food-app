import type { Order, OrderItem } from "../types";

export function orderLineKey(item: Pick<OrderItem, "productId" | "note" | "price">): string {
  return `${item.productId}\n${item.note || ""}\n${item.price}`;
}

export function sessionOrdersForTable(orders: Order[], occupiedAt: string | null): Order[] {
  return orders
    .filter((order) => {
      if (order.status === "pending") return true;
      return Boolean(occupiedAt && order.createdAt >= occupiedAt);
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function mergeOrderItems(orders: Order[]): OrderItem[] {
  const map = new Map<string, OrderItem>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = orderLineKey(item);
      const existing = map.get(key);
      if (existing) existing.quantity = Math.min(999, existing.quantity + item.quantity);
      else map.set(key, { ...item });
    }
  }
  return [...map.values()];
}

export function billTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function tableBillCode(tableNumber: number, at: string): string {
  const date = new Date(at);
  const stamp = Number.isNaN(date.getTime()) ? new Date() : date;
  const yy = String(stamp.getFullYear()).slice(-2);
  const mm = String(stamp.getMonth() + 1).padStart(2, "0");
  const dd = String(stamp.getDate()).padStart(2, "0");
  return `TBL-${tableNumber}-${yy}${mm}${dd}`;
}
