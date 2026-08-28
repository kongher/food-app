import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import os from "node:os";
import { defineConfig } from "vite";

function lanOrigin(port: number): string {
  const addresses: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.internal) continue;
      if (item.family !== "IPv4") continue;
      addresses.push(item.address);
    }
  }
  const ip =
    addresses.find((value) => value.startsWith("192.168.")) ??
    addresses.find((value) => value.startsWith("10.")) ??
    addresses.find((value) => value.startsWith("172.")) ??
    "";
  return ip ? `http://${ip}:${port}` : "";
}

const DEV_PORT = 5173;

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    __LAN_ORIGIN__: JSON.stringify(command === "serve" ? lanOrigin(DEV_PORT) : ""),
  },
  server: {
    host: true,
    port: DEV_PORT,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        timeout: 0,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
}));
