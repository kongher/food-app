import type { CorsOptions } from "cors";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { resolveAuthUser, verifyAuthToken } from "./auth.js";

let io: Server | null = null;

export function initSocket(server: HttpServer, cors: Pick<CorsOptions, "origin">): Server {
  io = new Server(server, {
    cors: {
      origin: cors.origin,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    void (async () => {
      const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
      const parsed = token ? verifyAuthToken(token) : null;
      const user = parsed ? await resolveAuthUser(parsed) : null;
      if (!user || (user.role !== "staff" && user.role !== "admin") || user.mustChangePassword) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.user = user;
      next();
    })().catch(() => next(new Error("unauthorized")));
  });

  io.on("connection", (socket) => {
    socket.join("desk");
  });

  return io;
}

export function disconnectUserSockets(userId: string): void {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.user?.id === userId) socket.disconnect(true);
  }
}

export function emitSocket(event: string, data: unknown): void {
  io?.to("desk").emit(event, data);
}
