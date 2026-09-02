export function formatVnd(value: number): string {
  return new Intl.NumberFormat("lo-LA").format(value) + " ກີບ";
}

const MAX_AMOUNT_DIGITS = 12;

export function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_AMOUNT_DIGITS);
}

/** Digits only → 10.000 / 100.000 / 1.000.000 */
export function formatGroupedAmount(value: string | number): string {
  const digits = digitsOnly(String(value));
  if (!digits) return "";
  const groups: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    groups.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return groups.join(".");
}

export function parseGroupedAmount(value: string): number | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${day}/${month}/${year}, ${time}`;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatElapsed(iso: string, now = Date.now()): string {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return "";
  const minutes = Math.max(0, Math.floor((now - start) / 60_000));
  if (minutes < 60) return `${minutes} ນາທີ`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ຊົ່ວໂມງ ${rest} ນາທີ` : `${hours} ຊົ່ວໂມງ`;
}

export function isSameLocalDay(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function isSameLocalMonth(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Internal YYYY-MM-DD → visible DD/MM/YYYY */
export function toDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Visible DD/MM/YYYY (or D/M/YYYY) → internal YYYY-MM-DD */
export function parseDisplayDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = parseDateInput(trimmed);
  if (iso) return toDateInputValue(iso);

  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toDateInputValue(date);
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function isInLocalRange(iso: string, start: Date, end: Date): boolean {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export function cartKey(productId: string, note: string): string {
  return `${productId}::${note.trim().toLowerCase()}`;
}

const FALLBACK_IMAGE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect fill="#ffedd5" width="240" height="240"/><text x="50%" y="54%" text-anchor="middle" font-size="52">🍜</text></svg>`,
  );

export function onImgError(event: { currentTarget: HTMLImageElement }): void {
  event.currentTarget.onerror = null;
  event.currentTarget.src = FALLBACK_IMAGE;
}

