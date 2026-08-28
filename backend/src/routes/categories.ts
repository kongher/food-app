import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "../lib/auth.js";
import { toPublic, toPublicList } from "../lib/serialize.js";
import { CategoryModel, ProductModel } from "../models/index.js";
import type { Category } from "../types.js";

export const categoriesRouter = Router();
categoriesRouter.use("/categories", requireAdmin);

function asName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

categoriesRouter.post("/categories", async (req, res) => {
  const name = asName((req.body as { name?: unknown } | undefined)?.name);
  if (!name) {
    res.status(400).json({ error: "ກະລຸນາໃສ່ຊື່ໝວດໝູ່." });
    return;
  }

  const duplicate = await CategoryModel.exists({ name });
  if (duplicate) {
    res.status(400).json({ error: "ໝວດໝູ່ນີ້ມີແລ້ວ." });
    return;
  }

  const category: Category = { id: `cat-${randomUUID()}`, name };
  await CategoryModel.create(category);
  res.status(201).json(category);
});

categoriesRouter.put("/categories/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const name = asName((req.body as { name?: unknown } | undefined)?.name);
  if (!name) {
    res.status(400).json({ error: "ກະລຸນາໃສ່ຊື່ໝວດໝູ່." });
    return;
  }

  const duplicate = await CategoryModel.exists({ name, id: { $ne: id } });
  if (duplicate) {
    res.status(400).json({ error: "ໝວດໝູ່ນີ້ມີແລ້ວ." });
    return;
  }

  const updated = toPublic<Category>(
    await CategoryModel.findOneAndUpdate({ id }, { $set: { name } }, { returnDocument: "after" }).lean(),
  );
  if (!updated) {
    res.status(404).json({ error: "ບໍ່ພົບໝວດໝູ່." });
    return;
  }

  res.json(updated);
});

categoriesRouter.delete("/categories/:id", async (req, res) => {
  const id = String(req.params.id ?? "");
  const inUse = await ProductModel.exists({ categoryId: id });
  if (inUse) {
    res.status(400).json({ error: "ຍັງມີອາຫານໃນໝວດໝູ່ນີ້, ລຶບບໍ່ໄດ້." });
    return;
  }
  const removed = await CategoryModel.findOneAndDelete({ id });
  if (!removed) {
    res.status(404).json({ error: "ບໍ່ພົບໝວດໝູ່." });
    return;
  }
  res.status(204).send();
});
