import { Navigate } from "react-router-dom";
import { isAdminLoggedIn, isStaffLoggedIn } from "../lib/session";
import type { ReactNode } from "react";

export function RequireAdmin({ children }: { children: ReactNode }) {
  if (isStaffLoggedIn()) {
    return <Navigate to="/staff" replace />;
  }
  if (!isAdminLoggedIn()) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
