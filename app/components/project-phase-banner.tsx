"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useActiveProject } from "./active-project-context";
import {
  getProjectUiSpec,
  legacyRequestStatusToProjectStatus,
  listAllowedProjectEvents,
  type ProjectStatus,
} from "../lib/state-machine";
import { listRequests, subscribeRequests, type PlatformRequest, type RequestAudience } from "../lib/requests-store";
import { routes } from "../lib/routes";

function projectStatusOf(request: PlatformRequest): ProjectStatus {
  return request.projectStatus ?? legacyRequestStatusToProjectStatus(request.status);
}

function ctaHrefForRequest(audience: RequestAudience, request: PlatformRequest, status: ProjectStatus): string {
  if (status === "DRAFT") return audience === "brf" ? "/brf/start/sammanfattning" : "/start/sammanfattning";
  if (status === "PUBLISHED" || status === "TENDERING") {
    return audience === "brf" ? routes.brf.requestsIndex({ requestId: request.id }) : routes.privatperson.requestsIndex({ requestId: request.id });
  }
  if (status === "OFFERS_RECEIVED" || status === "NEGOTIATION") {
    return audience === "brf" ? routes.brf.requestsIndex({ requestId: request.id }) : routes.privatperson.requestsIndex({ requestId: request.id });
  }
  if (status === "CONTRACTED" || status === "IN_PROGRESS" || status === "COMPLETED_PENDING_INSPECTION") {
    return audience === "brf" ? routes.brf.timelineIndex({ projectId: request.id }) : routes.privatperson.timelineIndex({ projectId: request.id });
  }
  return audience === "brf" ? routes.brf.requestsIndex({ requestId: request.id }) : routes.privatperson.requestsIndex({ requestId: request.id });
}

function moduleLabel(key: string): string {
  if (key === "requests") return "Förfrågningar";
  if (key === "offers") return "Offerter";
  if (key === "documents") return "Dokument";
  if (key === "messages") return "Meddelanden";
  if (key === "change_orders") return "ÄTA";
  if (key === "inspection") return "Besiktning";
  return key;
}

export function ProjectPhaseBanner({ audience }: { audience: RequestAudience }) {
  const { activeProject } = useActiveProject();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [expandedMissing, setExpandedMissing] = useState(false);

  useEffect(() => {
    const sync = () => {
      setRequests(listRequests().filter((request) => request.audience === audience));
    };
    sync();
    return subscribeRequests(sync);
  }, [audience]);

  const request = useMemo(() => {
    if (activeProject && activeProject.audience === audience) {
      const fromList = requests.find((entry) => entry.id === activeProject.id);
      if (fromList) return fromList;
    }
    return [...requests].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
  }, [activeProject, audience, requests]);

  if (!request) {
    return (
      <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Projektstatus</p>
        <p className="mt-1 text-sm text-[#6B5A47]">Inget aktivt projekt ännu. Starta en förfrågan för att se nästa steg.</p>
      </section>
    );
  }

  const status = projectStatusOf(request);
  const ui = getProjectUiSpec(status);
  const allowedEvents = listAllowedProjectEvents({
    projectId: request.id,
    currentStatus: status,
    requiredFieldsComplete: request.missingInfo.length === 0,
    attachmentsCount: request.files?.length ?? 0,
    recipientCount: request.recipients?.length ?? 0,
    offerCount: status === "OFFERS_RECEIVED" || status === "NEGOTIATION" ? 1 : undefined,
  });
  const primaryAction = allowedEvents.find((event) => event.allowed);
  const missingPreview = request.missingInfo.slice(0, 3);
  const ctaHref = ctaHrefForRequest(audience, request, status);

  return (
    <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Projektstatus</p>
          <h2 className="mt-1 text-lg font-bold text-[#2A2520]">{request.title}</h2>
          <p className="mt-1 text-sm text-[#6B5A47]">
            {ui.phaseLabel} · {ui.statusLabel}
          </p>
          <p className="mt-1 text-xs text-[#766B60]">Förfrågan-ID: {request.id}</p>
        </div>
        <Link
          href={ctaHref}
          className="inline-flex rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B5A47]"
        >
          {ui.primaryCtaLabel}
        </Link>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Vad saknas</p>
          {request.missingInfo.length === 0 ? (
            <p className="mt-1 text-sm text-[#355C38]">Inga uppenbara luckor just nu.</p>
          ) : (
            <>
              <ul className="mt-1 space-y-1">
                {(expandedMissing ? request.missingInfo : missingPreview).map((item) => (
                  <li key={item} className="text-sm text-[#6B5A47]">• {item}</li>
                ))}
              </ul>
              {request.missingInfo.length > 3 && (
                <button
                  type="button"
                  onClick={() => setExpandedMissing((current) => !current)}
                  className="mt-2 text-xs font-semibold text-[#8C7860] hover:text-[#6B5A47]"
                >
                  {expandedMissing ? "Visa färre" : `Visa alla (${request.missingInfo.length})`}
                </button>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Nästa steg / gating</p>
          <p className="mt-1 text-sm text-[#2A2520]">
            {primaryAction?.allowed ? ui.primaryCtaLabel : "Fasen blockerar vissa åtgärder"}
          </p>
          {ui.lockedModules.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ui.lockedModules.map((module) => (
                <span
                  key={module}
                  className="rounded-full border border-[#D9D1C6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#6B5A47]"
                  title="Låst i nuvarande fas"
                >
                  {moduleLabel(module)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
