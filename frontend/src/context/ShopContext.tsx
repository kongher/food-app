import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import type { Shop } from "../types";

export const DEFAULT_SHOP: Shop = {
  id: "default",
  name: "ຮ້ານອາຫານແຊບ",
  logo: "",
  updatedAt: "",
};

const BLANK_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";

interface ShopContextValue {
  shop: Shop;
  setShop: (shop: Shop) => void;
  refreshShop: () => Promise<void>;
}

const ShopContext = createContext<ShopContextValue | null>(null);

function applyShopToDocument(shop: Shop): void {
  document.title = `${shop.name} · ສັ່ງອາຫານ`;
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (link) link.href = shop.logo.trim() || BLANK_FAVICON;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shop, setShopState] = useState<Shop>(DEFAULT_SHOP);

  function setShop(next: Shop) {
    setShopState(next);
    applyShopToDocument(next);
  }

  async function refreshShop(): Promise<void> {
    try {
      const data = await api.getShop();
      setShop(data);
    } catch {
      applyShopToDocument(shop);
    }
  }

  useEffect(() => {
    void refreshShop();
  }, []);

  const value = useMemo(() => ({ shop, setShop, refreshShop }), [shop]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext);
  if (!ctx) {
    return {
      shop: DEFAULT_SHOP,
      setShop: () => undefined,
      refreshShop: async () => undefined,
    };
  }
  return ctx;
}
