import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import helmet from "helmet";
import mongoose from "mongoose";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb, disconnectDb } from "./db.js";
import { configureCloudinary, isCloudinaryConfigured } from "./lib/cloudinary.js";
import { corsOptions } from "./lib/cors.js";
import { initSocket } from "./lib/socket.js";
import { CategoryModel, OrderModel, ProductModel } from "./models/index.js";
import { authRouter } from "./routes/auth.js";
import { callsRouter } from "./routes/calls.js";
import { categoriesRouter } from "./routes/categories.js";
import { menuRouter } from "./routes/menu.js";
import { ordersRouter } from "./routes/orders.js";
import { productsRouter } from "./routes/products.js";
import { shopRouter } from "./routes/shop.js";
import { songsRouter } from "./routes/songs.js";
import { staffRouter } from "./routes/staff.js";
import { tablesRouter } from "./routes/tables.js";
import { uploadsRouter } from "./routes/uploads.js";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
configureCloudinary();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
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
app.use("/api", songsRouter);
app.use("/api", uploadsRouter);

function frontendDist(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST,
    path.join(backendRoot, "public"),
    path.join(process.cwd(), "public"),
    path.join(backendRoot, "..", "frontend", "dist"),
    path.join(process.cwd(), "frontend", "dist"),
    path.join(process.cwd(), "..", "frontend", "dist"),
  ].filter((value): value is string => Boolean(value));

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

function sendFrontend(distDir: string, res: express.Response, next: express.NextFunction): void {
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next(err);
  });
}

const dist = frontendDist();
if (dist) {
  app.use(express.static(dist, { index: "index.html" }));
  const serveSpa = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      next();
      return;
    }
    sendFrontend(dist, res, next);
  };
  app.get("/", serveSpa);
  app.get("/{*splat}", serveSpa);
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "ເຊີບເວີຜິດພາດ, ກະລຸນາລອງໃໝ່." });
});

async function main(): Promise<void> {
  await connectDb();
  const server = createServer(app);
  initSocket(server, corsOptions);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Food-app API running at http://localhost:${port}`);
    console.log(`Cloudinary: ${isCloudinaryConfigured() ? "configured" : "missing env"}`);
    console.log(`Frontend: ${dist ?? "not bundled"}`);
    if (!dist) {
      console.warn("SPA files missing: QR /menu will 404. Build frontend into backend/public.");
    }
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
