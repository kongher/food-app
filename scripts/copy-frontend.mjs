import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "frontend", "dist");
const dest = path.join(root, "backend", "public");

if (!fs.existsSync(path.join(src, "index.html"))) {
  console.error("frontend/dist/index.html is missing. Run the frontend build first.");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied frontend to ${dest}`);
