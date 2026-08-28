import type { CorsOptions } from "cors";

const LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
const RENDER_ORIGIN = /^https:\/\/[\w.-]+\.onrender\.com$/;

function extraOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const extra = extraOrigins();
  if (extra.includes("*")) return true;
  if (LOCAL_ORIGIN.test(origin)) return true;
  if (RENDER_ORIGIN.test(origin)) return true;
  if (extra.includes(origin)) return true;
  return extra.length === 0;
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
