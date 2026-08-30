import mongoose, { Schema } from "mongoose";
import type { UserAccount, UserRole } from "../lib/authTypes.js";

const userSchema = new Schema<UserAccount>(
  {
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "", trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "staff"], required: true },
    tokenVersion: { type: Number, default: 0 },
    mustChangePassword: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { versionKey: false, collection: "users" },
);

export const UserModel = mongoose.model<UserAccount>("User", userSchema);
export type { UserRole };
