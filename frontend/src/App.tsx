import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { CartProvider } from "./context/CartContext";
import { ShopProvider } from "./context/ShopContext";
import { isValidTableNumber, tableMenuPath } from "./lib/tableSession";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminPage } from "./pages/AdminPage";
import { CustomerMenu } from "./pages/CustomerPage";
import { RequireAdmin } from "./pages/RequireAdmin";
import { RequireStaff } from "./pages/RequireStaff";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { StaffPage } from "./pages/StaffPage";
import type { Category, Product } from "./types";

function customerElement() {
  return (
    <CartProvider>
      <CustomerShell />
    </CartProvider>
  );
}

export default function App() {
  return (
    <ShopProvider>
      <Routes>
        <Route
          path="/"
          element={<LegacyQueryTableRedirect>{customerElement()}</LegacyQueryTableRedirect>}
        />
        <Route
          path="/menu"
          element={<LegacyQueryTableRedirect>{customerElement()}</LegacyQueryTableRedirect>}
        />
        <Route path="/table/:id" element={customerElement()} />
        <Route path="/t/:tableNumber" element={<LegacyPathTableRedirect />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route
          path="/staff"
          element={
            <RequireStaff>
              <StaffPage />
            </RequireStaff>
          }
        />
        <Route path="*" element={<RedirectHome />} />
      </Routes>
    </ShopProvider>
  );
}

function tableFromQuery(params: URLSearchParams): number | null {
  const table = Number(params.get("table"));
  return isValidTableNumber(table) ? table : null;
}

function LegacyQueryTableRedirect({ children }: { children: ReactNode }) {
  const [params] = useSearchParams();
  const table = tableFromQuery(params);
  if (table) return <Navigate to={tableMenuPath(table)} replace />;
  return children;
}

function LegacyPathTableRedirect() {
  const { tableNumber } = useParams();
  const table = Number(tableNumber);
  if (isValidTableNumber(table)) return <Navigate to={tableMenuPath(table)} replace />;
  return <Navigate to="/" replace />;
}

function RedirectHome() {
  const [params] = useSearchParams();
  const table = tableFromQuery(params);
  if (table) return <Navigate to={tableMenuPath(table)} replace />;
  return <Navigate to="/" replace />;
}

function CustomerShell() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getMenu()
      .then((data) => {
        setProducts(data.products);
        setCategories(data.categories);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "ໂຫຼດເມນູບໍ່ສຳເລັດ.");
      })
      .finally(() => setLoading(false));
  }, []);

  return <CustomerMenu products={products} categories={categories} loading={loading} error={error} />;
}
