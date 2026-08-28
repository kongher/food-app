import { io, type Socket } from "socket.io-client";
import { getAuthToken } from "./session";

export function connectDeskSocket(): Socket {
  return io({
    auth: { token: getAuthToken() },
    transports: ["websocket", "polling"],
  });
}
