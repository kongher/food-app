export type UserRole = "admin" | "staff";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  tokenVersion?: number;
  mustChangePassword?: boolean;
}

export interface UserAccount extends AuthUser {
  name: string;
  passwordHash: string;
  createdAt: string;
  tokenVersion: number;
  mustChangePassword: boolean;
}
