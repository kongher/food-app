import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { randomUUID } from "node:crypto";
import { toPublic, toPublicList } from "../lib/serialize.js";
import { CategoryModel, ProductModel } from "../models/index.js";
import type { Product } from "../types.js";

export const productsRouter = Router();
productsRouter.use("/products", requireAdmin);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined) return fallback;
  return Boolean(value);
}

async function validateProductInput(
  body: unknown,
  existing?: Product,
): Promise<{ error: string } | { data: Omit<Product, "id"> }> {
  const payload = (body ?? {}) as Record<string, unknown>;
  const name = asString(payload.name) || existing?.name || "";
  const description = payload.description !== undefined ? asString(payload.description) : existing?.description ?? "";
  const image = payload.image !== undefined ? asString(payload.image) : existing?.image ?? "";
  const categoryId = asString(payload.categoryId) || existing?.categoryId || "";
  const price = payload.price !== undefined ? asNumber(payload.price) : existing?.price ?? null;
  const available = asBoolean(payload.available, existing?.available ?? true);

  if (!name) return { error: "ກະລຸນາໃສ່ຊື່ອາຫານ." };
  if (price === null || price < 0) return { error: "ລາຄາບໍ່ຖືກຕ້ອງ." };
  if (!categoryId) return { error: "ກະລຸນາເລືອກໝວດໝູ່." };

  const categoryExists = await CategoryModel.exists({ id: categoryId });
  if (!categoryExists) {
    return { error: "ໝວດໝູ່ບໍ່ມີໃນລະບົບ." };
  }

  return {
    data: {
      name,
      price,
      image:
        image ||
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      description,
      categoryId,
      available,
    },
  };
}

productsRouter.get("/products", async (_req, res) => {
  const products = await ProductModel.find().lean();
  res.json(toPublicList<Product>(products));
});

productsRouter.post("/products", async (req, res) => {
  const parsed = await validateProductInput(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const product: Product = { id: randomUUID(), ...parsed.data };
  await ProductModel.create(product);
  res.status(201).json(product);
});

productsRouter.put("/products/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = toPublic<Product>(await ProductModel.findOne({ id }).lean());
  if (!existing) {
    res.status(404).json({ error: "ບໍ່ພົບລາຍການອາຫານ." });
    return;
  }

  const parsed = await validateProductInput(req.body, existing);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const updated = toPublic<Product>(
    await ProductModel.findOneAndUpdate({ id }, { $set: parsed.data }, { returnDocument: "after" }).lean(),
  );
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບລາຍການອາຫານ." });
    return;
  }

  res.json(updated);
});

productsRouter.patch("/products/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const existing = toPublic<Product>(await ProductModel.findOne({ id }).lean());
  if (!existing) {
    res.status(404).json({ error: "ບໍ່ພົບລາຍການອາຫານ." });
    return;
  }

  const parsed = await validateProductInput({ ...existing, ...req.body }, existing);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const updated = toPublic<Product>(
    await ProductModel.findOneAndUpdate({ id }, { $set: parsed.data }, { returnDocument: "after" }).lean(),
  );
  res.json(updated);
});

productsRouter.delete("/products/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const removed = await ProductModel.findOneAndDelete({ id });
  if (!removed) {
    res.status(404).json({ error: "ບໍ່ພົບລາຍການອາຫານ." });
    return;
  }

  res.status(204).send();
});
