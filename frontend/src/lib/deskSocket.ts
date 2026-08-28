import { io, type Socket } from "socket.io-client";
import { getApiBase } from "../api";
import { getAuthToken } from "./session";

export function connectDeskSocket(): Socket {
  const base = getApiBase();
  const options = {
    auth: { token: getAuthToken() },
    transports: ["websocket", "polling"] as ("websocket" | "polling")[],
  };
  return base ? io(base, options) : io(options);
}
