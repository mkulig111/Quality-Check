export * from "./generated/api";

export interface AuthUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role?: "manager" | "inspector" | null;
}
