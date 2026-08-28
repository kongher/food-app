import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAuthToken } from "./auth.js";

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
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
