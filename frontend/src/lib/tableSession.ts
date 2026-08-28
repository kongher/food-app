const KEY = "food-app-table-number";
const PRODUCTION_ORIGIN = "https://food-app-dg0b.onrender.com";

export function isValidTableNumber(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export function getSavedTableNumber(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    const n = Number(raw);
    return isValidTableNumber(n) ? n : null;
  } catch {
    return null;
  }
}

export function saveTableNumber(tableNumber: number): void {
  if (!isValidTableNumber(tableNumber)) return;
  localStorage.setItem(KEY, String(tableNumber));
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function menuOrigin(): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;

  const { origin, hostname } = window.location;
  if (!isLoopbackHost(hostname)) return origin.replace(/\/$/, "");

  const lan = typeof __LAN_ORIGIN__ === "string" ? __LAN_ORIGIN__.trim().replace(/\/$/, "") : "";
  if (import.meta.env.DEV && lan) return lan;

  return PRODUCTION_ORIGIN;
}

export function menuUrlForTable(tableNumber: number): string {
  return `${menuOrigin()}/?table=${tableNumber}`;
}
