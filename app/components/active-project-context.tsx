"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  listRequests,
  subscribeRequests,
  type PlatformRequest,
} from "../lib/requests-store";
import { useAuth } from "./auth-context";

const ACTIVE_PROJECT_KEY = "byggplattformen-active-project-id";

function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

function writeStoredProjectId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

export interface ActiveProjectContextValue {
  requests: PlatformRequest[];
  activeProject: PlatformRequest | null;
  setActiveProjectId: (id: string) => void;
  clearActiveProject: () => void;
}

const ActiveProjectContext = createContext<ActiveProjectContextValue>({
  requests: [],
  activeProject: null,
  setActiveProjectId: () => undefined,
  clearActiveProject: () => undefined,
});

export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PlatformRequest[]>(() => listRequests());
  const [activeId, setActiveId] = useState<string | null>(() => readStoredProjectId());

  useEffect(() => {
    return subscribeRequests(() => {
      setRequests(listRequests());
    });
  }, []);

  const filteredRequests = useMemo(() => {
    if (!user) return requests;
    if (user.role === "entreprenor") return requests;
    if (user.role === "brf") return requests.filter((r) => r.audience === "brf");
    if (user.role === "privat") return requests.filter((r) => r.audience === "privat");
    return requests;
  }, [requests, user]);

  const resolvedId = useMemo(() => {
    if (activeId && filteredRequests.some((r) => r.id === activeId)) {
      return activeId;
    }
    return filteredRequests[0]?.id ?? null;
  }, [activeId, filteredRequests]);

  const activeProject = useMemo(
    () => filteredRequests.find((r) => r.id === resolvedId) ?? null,
    [filteredRequests, resolvedId]
  );

  const setActiveProjectId = useCallback((id: string) => {
    setActiveId(id);
    writeStoredProjectId(id);
  }, []);

  const clearActiveProject = useCallback(() => {
    setActiveId(null);
    writeStoredProjectId(null);
  }, []);

  const value = useMemo<ActiveProjectContextValue>(
    () => ({
      requests: filteredRequests,
      activeProject,
      setActiveProjectId,
      clearActiveProject,
    }),
    [filteredRequests, activeProject, setActiveProjectId, clearActiveProject]
  );

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}

export function useActiveProject(): ActiveProjectContextValue {
  return useContext(ActiveProjectContext);
}
