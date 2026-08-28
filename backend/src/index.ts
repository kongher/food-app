import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb, disconnectDb } from "./db.js";
import { configureCloudinary, isCloudinaryConfigured } from "./lib/cloudinary.js";
import { initSocket } from "./lib/socket.js";
import { CategoryModel, OrderModel, ProductModel } from "./models/index.js";
import { authRouter } from "./routes/auth.js";
import { callsRouter } from "./routes/calls.js";
import { categoriesRouter } from "./routes/categories.js";
import { menuRouter } from "./routes/menu.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { shopRouter } from "./routes/shop.js";
import { staffRouter } from "./routes/staff.js";
import { tablesRouter } from "./routes/tables.js";
import { uploadsRouter } from "./routes/uploads.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
configureCloudinary();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const [categories, products, orders] = await Promise.all([
    CategoryModel.countDocuments(),
    ProductModel.countDocuments(),
    OrderModel.countDocuments(),
  ]);
  res.json({
    ok: mongoose.connection.readyState === 1,
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    cloudinary: isCloudinaryConfigured(),
    categories,
    products,
    orders,
  });
});

app.use("/api", authRouter);
app.use("/api", menuRouter);
app.use("/api", shopRouter);
app.use("/api", tablesRouter);
app.use("/api", staffRouter);
app.use("/api", categoriesRouter);
app.use("/api", productsRouter);
app.use("/api", ordersRouter);
app.use("/api", callsRouter);
app.use("/api", uploadsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "ເຊີບເວີຜິດພາດ, ກະລຸນາລອງໃໝ່." });
});

async function main(): Promise<void> {
  await connectDb();
  const server = createServer(app);
  initSocket(server);
  server.listen(port, () => {
    console.log(`Food-app API running at http://localhost:${port}`);
    console.log(`Cloudinary: ${isCloudinaryConfigured() ? "configured" : "missing env"}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
