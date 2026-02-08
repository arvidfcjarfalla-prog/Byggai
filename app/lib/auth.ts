export type UserRole = "privat" | "brf" | "entreprenor" | "osaker";

export interface StoredUser {
  id: string;
  email: string;
  password: string;
  name?: string;
  role: UserRole;
  createdAt: string;
}

const USERS_KEY = "byggplattformen-users";
const SESSION_KEY = "byggplattformen-session";

export function getUsersStorageKey() {
  return USERS_KEY;
}

export function getSessionStorageKey() {
  return SESSION_KEY;
}

export function getDashboardPath(role: UserRole): string {
  if (role === "brf") return "/dashboard/brf";
  if (role === "entreprenor") return "/dashboard/entreprenor";
  return "/dashboard/privat";
}

export function getLandingPath(role: UserRole): string {
  if (role === "brf") return "/brf";
  if (role === "entreprenor") return "/entreprenor";
  if (role === "privat") return "/privatperson";
  return "/";
}
