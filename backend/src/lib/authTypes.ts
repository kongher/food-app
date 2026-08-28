export type UserRole = "admin" | "staff";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface UserAccount extends AuthUser {
  name: string;
  passwordHash: string;
  createdAt: string;
}
