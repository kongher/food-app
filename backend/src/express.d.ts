import type { AuthUser } from "./lib/authTypes.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
