"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { subscribeDocuments } from "../../lib/documents-store";
import { listFiles, subscribeProjectFiles } from "../../lib/project-files/store";
import type { ProjectFile } from "../../lib/project-files/types";
import { subscribeRequestMessages } from "../../lib/request-messages";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../lib/requests-store";
import { buildProjectTimeline } from "../../lib/timeline/builder";
import type { TimelineEventFilter, TimelineRole } from "../../lib/timeline/types";

type ActiveFilter = "alla" | TimelineEventFilter;

const EVENT_FILTERS: Array<{ id: ActiveFilter; label: string }> = [
  { id: "alla", label: "Alla" },
  { id: "dokument", label: "Dokument" },
  { id: "filer", label: "Filer" },
  { id: "ata", label: "ÄTA" },
  { id: "meddelanden", label: "Meddelanden" },
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Tid saknas";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Tid saknas";
  return parsed.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requestStatusLabel(status: PlatformRequest["status"]): string {
  if (status === "received") return "Svar inkommen";
  if (status === "draft") return "Utkast";
  return "Skickad";
}

function roleMatchesRequest(role: TimelineRole, request: PlatformRequest): boolean {
  if (role === "brf") return request.audience === "brf";
  if (role === "privatperson") return request.audience === "privat";
  return true;
}

function emptyStateAction(role: TimelineRole): { href: string; label: string } {
  if (role === "entreprenor") {
    return {
      href: "/dashboard/entreprenor/forfragningar",
      label: "Gå till förfrågningar",
    };
  }
  if (role === "brf") {
    return {
      href: "/brf/start",
      label: "Skapa anbudsförfrågan",
    };
  }
  return {
    href: "/start",
    label: "Skapa anbudsförfrågan",
  };
}

export function ProjectTimeline({
  role,
  initialProjectId,
}: {
  role: TimelineRole;
  initialProjectId?: string | null;
}) {
  const [version, setVersion] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId ?? "");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("alla");
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);

  useEffect(() => {
    const bump = () => setVersion((current) => current + 1);
    const unsubRequests = subscribeRequests(bump);
    const unsubDocuments = subscribeDocuments(bump);
    const unsubFiles = subscribeProjectFiles(bump);
    const unsubMessages = subscribeRequestMessages(bump);

    return () => {
      unsubRequests();
      unsubDocuments();
      unsubFiles();
      unsubMessages();
    };
  }, []);

  const requests = useMemo(
    () => {
      const marker = version;
      void marker;
      return listRequests()
        .filter((request) => roleMatchesRequest(role, request))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    [role, version]
  );

  const effectiveProjectId =
    selectedProjectId && requests.some((request) => request.id === selectedProjectId)
      ? selectedProjectId
      : requests[0]?.id || "";

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === effectiveProjectId) ?? null,
    [effectiveProjectId, requests]
  );

  useEffect(() => {
    let cancelled = false;
    const syncFiles = async () => {
      if (!effectiveProjectId) {
        if (!cancelled) setProjectFiles([]);
        return;
      }
      try {
        const files = await listFiles(effectiveProjectId);
        if (!cancelled) {
          setProjectFiles(files);
        }
      } catch {
        if (!cancelled) {
          setProjectFiles([]);
        }
      }
    };

    void syncFiles();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectId, version]);

  const timeline = useMemo(
    () => {
      const marker = version;
      void marker;
      return effectiveProjectId
        ? buildProjectTimeline({
            projectId: effectiveProjectId,
            role,
            sources: {
              files: projectFiles,
            },
          })
        : null;
    },
    [effectiveProjectId, projectFiles, role, version]
  );

  const visibleEvents = useMemo(() => {
    if (!timeline) return [];
    if (activeFilter === "alla") return timeline.events;
    return timeline.events.filter((event) => event.filters.includes(activeFilter));
  }, [activeFilter, timeline]);

  if (requests.length === 0 || !timeline) {
    const action = emptyStateAction(role);
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2520]">Projekt-tidslinje</h2>
        <p className="mt-2 text-sm text-[#766B60]">
          Inga projekt hittades ännu. Tidslinjen visas när en förfrågan finns i projektflödet.
        </p>
        <Link
          href={action.href}
          className="mt-4 inline-flex rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
        >
          {action.label}
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="text-sm font-semibold text-[#2A2520]">
            Välj projekt
            <select
              value={effectiveProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-[#FAF8F5] px-3 py-2 text-sm text-[#2A2520]"
            >
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.title}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-xs text-[#6B5A47]">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8C7860]">
              Projektkontext
            </p>
            <p className="font-semibold text-[#2A2520]">{timeline.projectTitle}</p>
            <p>
              Förfrågan-ID: <span className="font-mono">{timeline.projectId}</span>
            </p>
            {selectedRequest && (
              <p>
                Skapad: {formatDateTime(selectedRequest.createdAt)} · {requestStatusLabel(selectedRequest.status)}
              </p>
            )}
          </div>
        </div>
      </article>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Milstolpar</h3>
          <p className="mt-1 text-sm text-[#766B60]">
            Status beräknas automatiskt från förfrågan, dokument, filer, ÄTA och meddelanden.
          </p>

          <ol className="mt-4 space-y-3">
            {timeline.milestones.map((milestone) => {
              const done = milestone.state === "done";
              const current = milestone.state === "current";
              return (
                <li
                  key={milestone.id}
                  className={`rounded-2xl border px-3 py-3 ${
                    current
                      ? "border-[#8C7860] bg-[#F6F0E8]"
                      : done
                        ? "border-[#D9D1C6] bg-[#FBF9F5]"
                        : "border-[#ECE6DE] bg-[#FCFBF8]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        done
                          ? "bg-[#7A9D63] text-white"
                          : current
                            ? "bg-[#8C7860] text-white"
                            : "bg-[#E8E3DC] text-[#6B5A47]"
                      }`}
                    >
                      {done ? "✓" : milestone.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#2A2520]">{milestone.label}</p>
                      <p className="mt-1 text-xs text-[#6B5A47]">
                        {milestone.completedAt
                          ? formatDateTime(milestone.completedAt)
                          : milestone.optional
                            ? "Valfritt steg"
                            : "Ej uppnått"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            {timeline.actions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#2A2520]">Händelser</h3>
              <p className="mt-1 text-sm text-[#766B60]">
                Händelseström med tidsstämplar och länkar till underliggande objekt.
              </p>
            </div>
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-1">
              {EVENT_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                    activeFilter === filter.id
                      ? "bg-[#8C7860] text-white"
                      : "text-[#6B5A47] hover:bg-[#F3EEE6]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {visibleEvents.length === 0 ? (
            <p className="mt-4 rounded-xl border border-[#ECE6DE] bg-[#FCFBF8] px-3 py-2 text-sm text-[#766B60]">
              Inga händelser matchar valt filter.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {visibleEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
                    {formatDateTime(event.timestamp)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#2A2520]">{event.label}</p>
                  {event.refId && (
                    <p className="mt-1 font-mono text-[11px] text-[#6B5A47]">{event.refId}</p>
                  )}
                  {event.link && (
                    <Link
                      href={event.link.href}
                      className="mt-2 inline-flex text-xs font-semibold text-[#6B5A47] underline decoration-[#C7B8A5] underline-offset-2"
                    >
                      {event.link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
