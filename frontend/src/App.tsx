import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { CartProvider } from "./context/CartContext";
import { ShopProvider } from "./context/ShopContext";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminPage } from "./pages/AdminPage";
import { CustomerMenu } from "./pages/CustomerPage";
import { RequireAdmin } from "./pages/RequireAdmin";
import { RequireStaff } from "./pages/RequireStaff";
import { StaffLoginPage } from "./pages/StaffLoginPage";
import { StaffPage } from "./pages/StaffPage";
import type { Category, Product } from "./types";

export default function App() {
  return (
    <ShopProvider>
      <Routes>
        <Route
          path="/"
          element={
            <CartProvider>
              <CustomerShell />
            </CartProvider>
          }
        />
        <Route
          path="/menu"
          element={
            <CartProvider>
              <CustomerShell />
            </CartProvider>
          }
        />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShopProvider>
  );
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
