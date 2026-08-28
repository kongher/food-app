import { Router } from "express";
import { toPublicList } from "../lib/serialize.js";
import { CategoryModel, ProductModel } from "../models/index.js";
import type { Category, Product } from "../types.js";

export const menuRouter = Router();

menuRouter.get("/menu", async (_req, res) => {
  const [categories, products] = await Promise.all([
    CategoryModel.find().lean(),
    ProductModel.find({ available: true }).lean(),
  ]);
  res.json({
    categories: toPublicList<Category>(categories),
    products: toPublicList<Product>(products),
  });
});

menuRouter.get("/categories", async (_req, res) => {
  const categories = await CategoryModel.find().lean();
  res.json(toPublicList<Category>(categories));
});
