import { Navigate } from "react-router-dom";
import { isAdminLoggedIn, isStaffLoggedIn } from "../lib/session";
import type { ReactNode } from "react";

export function RequireStaff({ children }: { children: ReactNode }) {
  if (isAdminLoggedIn()) {
    return <Navigate to="/admin" replace />;
  }
  if (!isStaffLoggedIn()) {
    return <Navigate to="/staff/login" replace />;
  }
  return children;
}
