import type { Order } from "../types";
import { toDateInputValue, toDisplayDate } from "./format";

export function displayOrderCode(order: Pick<Order, "id" | "createdAt"> & { code?: string }): string {
  if (order.code) return order.code;
  const at = new Date(order.createdAt);
  const date = Number.isNaN(at.getTime()) ? new Date() : at;
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = order.id.replace(/-/g, "").slice(-4).toUpperCase();
  return `ORD-${yy}${mm}${dd}-${suffix}`;
}

export function matchesOrderSearch(order: Order, query: string): boolean {
  const raw = query.trim().toLowerCase();
  if (!raw) return true;

  const compact = raw.replace(/\s+/g, "");
  const code = displayOrderCode(order).toLowerCase();
  const codeCompact = code.replace(/-/g, "");
  const table = String(order.tableNumber);

  if (/^\d{1,3}$/.test(compact)) {
    return table === compact;
  }

  if (compact === `ໂຕະ${table}` || compact === `table${table}` || compact === `t${table}`) {
    return true;
  }

  const qCode = compact.replace(/-/g, "");
  if (code.includes(compact) || (qCode.length >= 4 && codeCompact.includes(qCode))) {
    return true;
  }

  const created = new Date(order.createdAt);
  if (!Number.isNaN(created.getTime())) {
    const isoDay = toDateInputValue(created);
    const displayDay = toDisplayDate(isoDay).toLowerCase();
    const yyyymmdd = isoDay.replace(/-/g, "");
    const yymmdd = yyyymmdd.slice(2);
    const digits = compact.replace(/[./-]/g, "");
    const looksLikeDate = /[./-]/.test(compact) || /^(20)?\d{6,8}$/.test(digits);

    if (looksLikeDate) {
      if (isoDay.includes(compact) || displayDay.includes(compact)) return true;
      if (digits.length >= 4 && (yymmdd.includes(digits) || yyyymmdd.includes(digits))) return true;
    }
  }

  return order.items.some((item) => item.name.toLowerCase().includes(raw));
}
