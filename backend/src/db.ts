import mongoose from "mongoose";
import { CategoryModel, ProductModel, StaffCallModel } from "./models/index.js";
import { ensureDefaultShop } from "./models/shop.js";
import { ensureDefaultTables } from "./models/table.js";
import { mergeDuplicatePendingCalls } from "./models/staffCall.js";
import { ensureDefaultUsers } from "./lib/auth.js";
import { createSeedData } from "./seed.js";

function normalizeMongoUri(uri: string): string {
  return uri.trim().replace(/([?&])food-app=/, "$1appName=");
}

export async function connectDb(): Promise<void> {
  const raw = process.env.MONGODB_URI;
  if (!raw) {
    throw new Error("Missing MONGODB_URI in backend/.env");
  }

  const uri = normalizeMongoUri(raw);
  const dbName = process.env.MONGODB_DB_NAME || "food-app";

  try {
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`MongoDB connected (${mongoose.connection.name})`);
    await seedIfEmpty();
    await ensureDefaultShop();
    await ensureDefaultTables();
    await ensureDefaultUsers();
    await mergeDuplicatePendingCalls();
    await StaffCallModel.syncIndexes();
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err;
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB error:", err);
  });
}

async function seedIfEmpty(): Promise<void> {
  const categoryCount = await CategoryModel.countDocuments();
  if (categoryCount > 0) return;

  const seed = createSeedData();
  await CategoryModel.insertMany(seed.categories);
  await ProductModel.insertMany(seed.products);
  console.log(`Seeded ${seed.categories.length} categories and ${seed.products.length} products`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
