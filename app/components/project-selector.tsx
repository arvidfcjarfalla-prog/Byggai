"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { useActiveProject } from "./active-project-context";
import { routes } from "../lib/routes";
import { renameRequestProjectTitle } from "../lib/requests-store";
import type { PlatformRequest } from "../lib/requests-store";

function audienceLabel(r: PlatformRequest): string {
  return r.audience === "brf" ? "BRF" : "Privatperson";
}

function statusBadge(status: PlatformRequest["status"]): { label: string; className: string } {
  if (status === "received") {
    return { label: "Svar inkommen", className: "bg-[#D4EFDF] text-[#1A6B3A]" };
  }
  if (status === "draft") {
    return { label: "Utkast", className: "bg-[#F5F5F5] text-[#766B60]" };
  }
  return { label: "Skickad", className: "bg-[#EBF4FA] text-[#2E6DA4]" };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { month: "short", day: "numeric" });
}

function groupByAssociation(requests: PlatformRequest[]): Map<string, PlatformRequest[]> {
  const map = new Map<string, PlatformRequest[]>();
  for (const r of requests) {
    const key = r.propertySnapshot?.title?.trim() || r.snapshot?.overview?.title?.trim() || r.title;
    const existing = map.get(key) ?? [];
    existing.push(r);
    map.set(key, existing);
  }
  return map;
}

export function ProjectSelectorWidget() {
  const { user } = useAuth();
  const { requests, activeProject, setActiveProjectId } = useActiveProject();
  const router = useRouter();
  const role = user?.role;
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  if (!role || role === "osaker") return null;
  if (requests.length === 0) return null;

  const widgetTitle =
    role === "entreprenor" ? "Aktivt projekt" : role === "brf" ? "Förening & projekt" : "Mina projekt";
  const activeBadge = activeProject ? statusBadge(activeProject.status) : null;

  const goToProject = (requestId: string) => {
    setActiveProjectId(requestId);
    if (role === "entreprenor") {
      router.push(routes.entreprenor.requestDetail({ requestId }));
      return;
    }
    if (role === "brf") {
      router.push(routes.brf.requestsIndex({ requestId }));
      return;
    }
    router.push(routes.privatperson.requestsIndex({ requestId }));
  };

  const startRename = (request: PlatformRequest) => {
    setRenamingId(request.id);
    setRenamingValue(request.title);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenamingValue("");
  };

  const saveRename = (requestId: string) => {
    const trimmed = renamingValue.trim();
    if (!trimmed) return;
    renameRequestProjectTitle(requestId, trimmed);
    cancelRename();
  };

  const renderProjectOption = (
    request: PlatformRequest,
    options?: {
      displayTitle?: string;
      subtitle?: string;
    }
  ) => {
    const active = request.id === activeProject?.id;
    const badge = statusBadge(request.status);
    const isEditing = renamingId === request.id;
    const subtitle =
      options?.subtitle ??
      (role === "entreprenor"
        ? `${audienceLabel(request)} · ${formatDate(request.createdAt)}`
        : formatDate(request.createdAt));

    return (
      <div
        key={request.id}
        className={`rounded-xl border px-3 py-2 transition ${
          active ? "border-[#8C7860] bg-[#F6F0E8]" : "border-transparent hover:bg-[#F6F0E8]"
        }`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <input
              value={renamingValue}
              onChange={(event) => setRenamingValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveRename(request.id);
                }
                if (event.key === "Escape") {
                  cancelRename();
                }
              }}
              autoFocus
              className="w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-sm font-semibold text-[#2A2520]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => saveRename(request.id)}
                className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Spara
              </button>
              <button
                type="button"
                onClick={cancelRename}
                className="rounded-lg border border-[#E8E3DC] bg-[#FAF8F5] px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-white"
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                goToProject(request.id);
                setOpen(false);
              }}
              className="w-full text-left text-sm"
            >
              <span className={`block truncate ${active ? "font-semibold text-[#2A2520]" : "font-semibold text-[#4A3F35]"}`}>
                {options?.displayTitle ?? request.title}
              </span>
              <span className="mt-0.5 block text-xs text-[#766B60]">{subtitle}</span>
            </button>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
              <button
                type="button"
                onClick={() => startRename(request)}
                className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Byt namn
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const listContent = role === "entreprenor" ? (
    <div className="space-y-1">
      {requests.map((r) => renderProjectOption(r))}
    </div>
  ) : role === "brf" ? (
    <div className="space-y-3">
      {Array.from(groupByAssociation(requests).entries()).map(([association, assocRequests]) => (
        <div key={association}>
          <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-[#4A3F35]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#8C7860]" />
            {association}
          </p>
          <div className="space-y-1 pl-3">
            {assocRequests.map((r) => {
              const projectLabel =
                assocRequests.length === 1 ? r.title : r.title.replace(association, "").trim() || r.title;
              return renderProjectOption(r, { displayTitle: projectLabel, subtitle: formatDate(r.createdAt) });
            })}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-1">
      {requests.map((r) => renderProjectOption(r))}
    </div>
  );

  return (
    <div className="mb-6">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#8C7860]">
        {widgetTitle}
      </p>
      <div className="rounded-2xl border border-[#E6DFD6] bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-[#FAF8F5]"
          aria-expanded={open}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#2A2520]">
              {activeProject?.title ?? "Välj projekt"}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#766B60]">
              {activeProject
                ? `${activeProject.location} · ${requests.length} projekt`
                : `${requests.length} projekt`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeBadge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${activeBadge.className}`}>
                {activeBadge.label}
              </span>
            )}
            <span className="text-xs font-semibold text-[#8C7860]">{open ? "▴" : "▾"}</span>
          </div>
        </button>
        {open && <div className="border-t border-[#E8E3DC] p-2">{listContent}</div>}
      </div>
    </div>
  );
}

export function ActiveProjectBanner() {
  const { activeProject, requests, setActiveProjectId } = useActiveProject();
  const { user } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (!activeProject) return null;

  const badge = statusBadge(activeProject.status);
  const saveName = () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === activeProject.title) {
      setIsEditingName(false);
      return;
    }
    renameRequestProjectTitle(activeProject.id, trimmed);
    setIsEditingName(false);
  };

  return (
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#E6DFD6] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#8C7860]" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8C7860]">
            Aktivt projekt
          </p>
          {isEditingName ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveName();
                  }
                  if (event.key === "Escape") {
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className="w-[min(420px,55vw)] rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-sm font-semibold text-[#2A2520]"
              />
              <button
                type="button"
                onClick={saveName}
                className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Spara namn
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="rounded-lg border border-[#E8E3DC] bg-[#FAF8F5] px-2 py-1 text-xs font-semibold text-[#6B5A47] hover:bg-white"
              >
                Avbryt
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#2A2520]">{activeProject.title}</p>
              <button
                type="button"
                onClick={() => {
                  setDraftName(activeProject.title);
                  setIsEditingName(true);
                }}
                className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Byt namn
              </button>
            </div>
          )}
          <p className="text-xs text-[#766B60]">
            {activeProject.location}
            {activeProject.propertySnapshot?.address &&
            activeProject.propertySnapshot.address !== activeProject.location
              ? ` · ${activeProject.propertySnapshot.address}`
              : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
          {badge.label}
        </span>

        {requests.length > 1 && (
          <select
            className="rounded-lg border border-[#E6DFD6] bg-[#FAF8F5] px-2 py-1.5 text-xs font-semibold text-[#6B5A47] focus:outline-none"
            value={activeProject.id}
            onChange={(event) => setActiveProjectId(event.target.value)}
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
