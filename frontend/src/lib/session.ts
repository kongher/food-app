export type UserRole = "admin" | "staff";

export interface AuthSession {
  token: string;
  role: UserRole;
  username: string;
  mustChangePassword?: boolean;
}

const KEY = "food-app-auth";
const LEGACY_ADMIN_KEY = "food-app-admin-auth";

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AuthSession;
    if (!data?.token || (data.role !== "admin" && data.role !== "staff")) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_ADMIN_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_ADMIN_KEY);
}

export function getAuthToken(): string {
  return getSession()?.token ?? "";
}

export function isAdminLoggedIn(): boolean {
  return getSession()?.role === "admin";
}

export function isStaffLoggedIn(): boolean {
  return getSession()?.role === "staff";
}

export function adminEntryPath(): "/admin" | "/admin/login" {
  return isAdminLoggedIn() ? "/admin" : "/admin/login";
}

export function logoutSession(): void {
  clearSession();
}
