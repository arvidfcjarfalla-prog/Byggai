"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { StoredUser, UserRole } from "../lib/auth";
import { getSessionStorageKey, getUsersStorageKey } from "../lib/auth";

interface AuthContextType {
  user: StoredUser | null;
  ready: boolean;
  signUp: (input: {
    email: string;
    password: string;
    name?: string;
    role: UserRole;
  }) => { ok: true; user: StoredUser } | { ok: false; error: string };
  signIn: (
    email: string,
    password: string
  ) => { ok: true; user: StoredUser } | { ok: false; error: string };
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEV_ROLE_OVERRIDE_KEY = "byggplattformen-dev-role-override";
const DEV_BYPASS_DISABLED_KEY = "byggplattformen-dev-bypass-disabled";
let hydrationSnapshot = false;

function subscribeHydration(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const rafId = window.requestAnimationFrame(() => {
    hydrationSnapshot = true;
    callback();
  });
  return () => window.cancelAnimationFrame(rafId);
}

function getHydrationSnapshot() {
  return hydrationSnapshot;
}

function getServerHydrationSnapshot() {
  return false;
}

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(getUsersStorageKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getUsersStorageKey(), JSON.stringify(users));
}

function readSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(getSessionStorageKey());
}

function writeSessionUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  if (!userId) {
    localStorage.removeItem(getSessionStorageKey());
    return;
  }
  localStorage.setItem(getSessionStorageKey(), userId);
}

function getDevBypassUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== "true") return null;
  if (localStorage.getItem(DEV_BYPASS_DISABLED_KEY) === "true") return null;

  const role =
    localStorage.getItem(DEV_ROLE_OVERRIDE_KEY) ||
    process.env.NEXT_PUBLIC_DEV_BYPASS_ROLE;
  const normalizedRole: UserRole =
    role === "brf" || role === "entreprenor" || role === "osaker"
      ? role
      : "privat";

  return {
    id: "dev-user",
    email: "dev@byggplattformen.local",
    password: "dev-only",
    name: "Dev User",
    role: normalizedRole,
    createdAt: new Date(0).toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getServerHydrationSnapshot
  );
  const [sessionUser, setSessionUser] = useState<StoredUser | null>(null);

  const persistentUser = useMemo<StoredUser | null>(() => {
    if (!hydrated) return null;
    const sessionUserId = readSessionUserId();
    const users = readUsers();
    const matchedSessionUser = users.find((u) => u.id === sessionUserId) ?? null;
    if (matchedSessionUser) return matchedSessionUser;
    const devUser = getDevBypassUser();
    if (devUser) return devUser;
    return null;
  }, [hydrated]);
  const user = sessionUser ?? persistentUser;
  const ready = hydrated;

  const signUp = useCallback(
    (input: { email: string; password: string; name?: string; role: UserRole }) => {
      const email = input.email.trim().toLowerCase();
      if (!email) return { ok: false as const, error: "E-post krävs." };
      if (!input.password || input.password.length < 8) {
        return { ok: false as const, error: "Lösenord måste vara minst 8 tecken." };
      }

      const users = readUsers();
      if (users.some((u) => u.email === email)) {
        return { ok: false as const, error: "E-postadressen används redan." };
      }

      const newUser: StoredUser = {
        id: `u_${Date.now()}`,
        email,
        password: input.password,
        name: input.name?.trim() || undefined,
        role: input.role,
        createdAt: new Date().toISOString(),
      };

      writeUsers([newUser, ...users]);
      writeSessionUserId(newUser.id);
      if (typeof window !== "undefined") {
        localStorage.removeItem(DEV_BYPASS_DISABLED_KEY);
      }
      setSessionUser(newUser);
      return { ok: true as const, user: newUser };
    },
    []
  );

  const signIn = useCallback((email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();
    const matched = users.find(
      (u) => u.email === normalizedEmail && u.password === password
    );
    if (!matched) {
      return { ok: false as const, error: "Fel e-post eller lösenord." };
    }
    writeSessionUserId(matched.id);
    if (typeof window !== "undefined") {
      localStorage.removeItem(DEV_BYPASS_DISABLED_KEY);
    }
    setSessionUser(matched);
    return { ok: true as const, user: matched };
  }, []);

  const signOut = useCallback(() => {
    writeSessionUserId(null);
    if (typeof window !== "undefined") {
      localStorage.setItem(DEV_BYPASS_DISABLED_KEY, "true");
      localStorage.removeItem(DEV_ROLE_OVERRIDE_KEY);
    }
    setSessionUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user, ready, signUp, signIn, signOut }),
    [ready, signIn, signOut, signUp, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
