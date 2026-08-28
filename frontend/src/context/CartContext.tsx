import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { cartKey } from "../lib/format";
import type { CartItem, Product } from "../types";

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: Product, quantity: number, note: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      items,
      count,
      total,
      addItem(product, quantity, note) {
        const key = cartKey(product.id, note);
        setItems((current) => {
          const existing = current.find((item) => item.key === key);
          if (existing) {
            return current.map((item) =>
              item.key === key ? { ...item, quantity: item.quantity + quantity } : item,
            );
          }
          return [
            ...current,
            {
              key,
              productId: product.id,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity,
              note: note.trim(),
            },
          ];
        });
      },
      setQuantity(key, quantity) {
        setItems((current) => {
          if (quantity <= 0) return current.filter((item) => item.key !== key);
          return current.map((item) => (item.key === key ? { ...item, quantity } : item));
        });
      },
      removeItem(key) {
        setItems((current) => current.filter((item) => item.key !== key));
      },
      clear() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
