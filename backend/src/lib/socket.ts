import type { CorsOptions } from "cors";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAuthToken } from "./auth.js";

let io: Server | null = null;

export function initSocket(server: HttpServer, cors: Pick<CorsOptions, "origin">): Server {
  io = new Server(server, {
    cors: {
      origin: cors.origin,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
    const user = token ? verifyAuthToken(token) : null;
    if (!user || (user.role !== "staff" && user.role !== "admin")) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    socket.join("desk");
  });

  return io;
}

export function emitSocket(event: string, data: unknown): void {
  io?.to("desk").emit(event, data);
}
