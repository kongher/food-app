const KEY = "food-app-table-number";

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

export function menuUrlForTable(tableNumber: number): string {
  return `${window.location.origin}/menu?table=${tableNumber}`;
}
