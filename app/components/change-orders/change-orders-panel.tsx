"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approveProjectChangeOrder,
  createProjectChangeOrder,
  listChangeOrdersByProject,
  rejectProjectChangeOrder,
  subscribeChangeOrders,
} from "../../lib/change-orders/store";
import {
  getChangeOrderTimeRemainingMs,
  legacyRequestStatusToProjectStatus,
  type ChangeOrderRecord,
  type ProjectStatus,
} from "../../lib/state-machine";
import {
  backfillRequestStartedFromAcceptedCustomerDocument,
  type PlatformRequest,
} from "../../lib/requests-store";

type ActorRole = "bestallare" | "entreprenor";

function formatSek(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr`;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemaining(order: ChangeOrderRecord): string {
  if (order.status !== "PENDING") return "Beslut registrerat / eskalerad";
  const remainingMs = getChangeOrderTimeRemainingMs(order);
  if (remainingMs <= 0) return "Svarstid passerad";
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const extraHours = hours % 24;
    return `${days} d ${extraHours} h kvar`;
  }
  return `${hours} h ${minutes} min kvar`;
}

function statusBadgeClass(status: ChangeOrderRecord["status"]): string {
  if (status === "APPROVED") return "border-[#CFE6CC] bg-[#F2FAF0] text-[#355C38]";
  if (status === "REJECTED") return "border-[#F0D7D7] bg-[#FFF5F5] text-[#8D3A3A]";
  if (status === "ESCALATED") return "border-[#F2D6B0] bg-[#FFF8EE] text-[#8A5B20]";
  return "border-[#D9D1C6] bg-white text-[#6B5A47]";
}

function statusLabel(status: ChangeOrderRecord["status"]): string {
  if (status === "APPROVED") return "Godkänd";
  if (status === "REJECTED") return "Avvisad";
  if (status === "ESCALATED") return "Eskalering";
  return "Väntar svar";
}

function projectStatusOf(request: PlatformRequest): ProjectStatus {
  return request.projectStatus ?? legacyRequestStatusToProjectStatus(request.status);
}

export function ChangeOrdersPanel({
  projectId,
  actorRole,
  request,
  title = "ÄTA (48h-regel)",
}: {
  projectId: string;
  actorRole: ActorRole;
  request?: PlatformRequest | null;
  title?: string;
}) {
  const [items, setItems] = useState<ChangeOrderRecord[]>([]);
  const [description, setDescription] = useState("");
  const [costEstimate, setCostEstimate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setItems(listChangeOrdersByProject(projectId));
    };
    sync();
    return subscribeChangeOrders(sync);
  }, [projectId]);

  useEffect(() => {
    if (actorRole !== "entreprenor" || !request) return;
    const status = projectStatusOf(request);
    if (
      status === "IN_PROGRESS" ||
      status === "COMPLETED_PENDING_INSPECTION" ||
      status === "CLOSED" ||
      status === "CANCELLED"
    ) {
      return;
    }
    void backfillRequestStartedFromAcceptedCustomerDocument(request.id, {
      actorLabel: "System (ÄTA-lås upp via signerad offert)",
    });
  }, [actorRole, request?.id, request?.status, request?.projectStatus]);

  const projectStatus = request ? projectStatusOf(request) : undefined;
  const canCreate =
    actorRole === "entreprenor" && (!projectStatus || projectStatus === "IN_PROGRESS");
  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "PENDING" || item.status === "ESCALATED").length,
    [items]
  );

  const handleCreate = () => {
    const trimmed = description.trim();
    const amount = Number(costEstimate.replace(/\s/g, "").replace(",", "."));
    if (!trimmed) {
      setError("Beskrivning krävs.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Ange en giltig kostnadsuppskattning.");
      return;
    }

    const generatedId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `co-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    createProjectChangeOrder({
      id: generatedId,
      projectId,
      description: trimmed,
      costEstimateSek: amount,
    });
    setDescription("");
    setCostEstimate("");
    setError(null);
  };

  return (
    <article className="rounded-2xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">ÄTA</p>
          <h3 className="text-lg font-bold text-[#2A2520]">{title}</h3>
          <p className="mt-1 text-sm text-[#6B5A47]">
            Skriftligt godkännande/avslag. Svarstid 48h, därefter markeras ärendet som eskalerat.
          </p>
        </div>
        <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2.5 py-1 text-xs font-semibold text-[#6B5A47]">
          {items.length} ärende{items.length === 1 ? "" : "n"} · {pendingCount} öppna
        </span>
      </div>

      {actorRole === "entreprenor" && (
        <div className="mt-4 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">Skapa ÄTA</p>
          {!canCreate && (
            <p className="mt-1 rounded-lg border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
              ÄTA kan skapas när projektet är i fasen <span className="font-semibold">Pågående</span>.
            </p>
          )}
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_160px_auto]">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Beskriv ändringen, varför den behövs och vad som påverkas."
              className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none ring-0 placeholder:text-[#9A8E80] focus:border-[#8C7860]"
            />
            <input
              value={costEstimate}
              onChange={(event) => setCostEstimate(event.target.value)}
              inputMode="numeric"
              placeholder="Kostnad (kr)"
              className="h-fit rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520] outline-none ring-0 placeholder:text-[#9A8E80] focus:border-[#8C7860]"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className="h-fit rounded-xl bg-[#2F2F31] px-4 py-2 text-sm font-semibold text-white hover:bg-[#19191A] disabled:cursor-not-allowed disabled:bg-[#CFC8BF]"
            >
              Skapa ÄTA
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-[#8D3A3A]">{error}</p>}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#D9D1C6] bg-[#FAF8F5] px-3 py-3 text-sm text-[#6B5A47]">
            Inga ÄTA-ärenden registrerade ännu.
          </p>
        ) : (
          items.map((item) => {
            const canDecide =
              actorRole === "bestallare" &&
              (item.status === "PENDING" || item.status === "ESCALATED");
            return (
              <div key={item.id} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                      <span className="text-xs text-[#766B60]">#{item.id.slice(0, 8)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#2A2520]">{item.description}</p>
                    <p className="mt-1 text-xs text-[#6B5A47]">
                      Estimat: {formatSek(item.costEstimateSek)} · Skapad {formatDateTime(item.createdAt)} ·{" "}
                      {formatRemaining(item)}
                    </p>
                    {(item.decidedAt || item.escalatedAt) && (
                      <p className="mt-1 text-xs text-[#6B5A47]">
                        {item.decidedAt ? `Beslut: ${formatDateTime(item.decidedAt)}` : ""}
                        {item.decidedAt && item.escalatedAt ? " · " : ""}
                        {item.escalatedAt ? `Eskalering: ${formatDateTime(item.escalatedAt)}` : ""}
                      </p>
                    )}
                  </div>
                  {canDecide && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => approveProjectChangeOrder(item.id)}
                        className="rounded-lg border border-[#CFE6CC] bg-white px-3 py-2 text-xs font-semibold text-[#355C38] hover:bg-[#F2FAF0]"
                      >
                        Godkänn
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectProjectChangeOrder(item.id)}
                        className="rounded-lg border border-[#F0D7D7] bg-white px-3 py-2 text-xs font-semibold text-[#8D3A3A] hover:bg-[#FFF5F5]"
                      >
                        Avvisa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}
