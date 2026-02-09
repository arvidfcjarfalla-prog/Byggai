"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listRequests,
  saveRequest,
  subscribeRequests,
  toRecipientLabel,
  type PlatformRequest,
  type RequestAudience,
  type RequestRecipient,
  type RequestRecipientStatus,
} from "../lib/requests-store";

function formatDate(iso: string): string {
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

function toStatusLabel(status: PlatformRequest["status"]): string {
  if (status === "draft") return "Utkast";
  if (status === "received") return "Svar inkommen";
  return "Skickad";
}

function recipientStatusLabel(status: RequestRecipientStatus): string {
  if (status === "opened") return "Öppnad";
  if (status === "responded") return "Svarad";
  if (status === "declined") return "Avböjd";
  return "Skickad";
}

function recipientStatusClass(status: RequestRecipientStatus): string {
  if (status === "responded") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "opened") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "declined") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-[#D9D1C6] bg-[#FAF8F5] text-[#6B5A47]";
}

function toRecipientEditLines(request: PlatformRequest): string {
  if (request.recipients && request.recipients.length > 0) {
    return request.recipients.map((recipient) => toRecipientLabel(recipient)).join("\n");
  }
  return (request.distribution || []).join("\n");
}

function toRecipientKey(companyName: string, email?: string): string {
  return `${companyName.trim().toLowerCase()}|${email?.trim().toLowerCase() || ""}`;
}

function toRecipientId(companyName: string, email?: string): string {
  const value = `${companyName}-${email || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value.length > 0 ? value : `recipient-${Date.now()}`;
}

function parseRecipientLine(line: string): { companyName: string; email?: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const angleMatch = trimmed.match(/^(.*)<([^>]+)>$/);
  if (angleMatch) {
    const companyName = angleMatch[1]?.trim() || "Entreprenör";
    const email = angleMatch[2]?.trim();
    return { companyName, email: email && email.length > 0 ? email : undefined };
  }

  const pipeParts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    return {
      companyName: pipeParts[0] || "Entreprenör",
      email: pipeParts.slice(1).join(" | "),
    };
  }

  const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) {
    const email = emailMatch[0].trim();
    const companyName = trimmed.replace(emailMatch[0], "").replace(/[()<>-]/g, "").trim();
    return { companyName: companyName || "Entreprenör", email };
  }

  return { companyName: trimmed };
}

function parseRecipients(
  rawLines: string,
  existingRecipients: RequestRecipient[],
  fallbackSentAt: string
): RequestRecipient[] {
  const existingByKey = new Map(
    existingRecipients.map((recipient) => [
      toRecipientKey(recipient.companyName, recipient.email),
      recipient,
    ])
  );

  const rows = rawLines
    .split("\n")
    .map((row) => parseRecipientLine(row))
    .filter((row): row is { companyName: string; email?: string } => row !== null);

  const deduped = new Map<string, { companyName: string; email?: string }>();
  rows.forEach((row) => {
    const key = toRecipientKey(row.companyName, row.email);
    if (!deduped.has(key)) deduped.set(key, row);
  });

  return Array.from(deduped.values()).map((row) => {
    const key = toRecipientKey(row.companyName, row.email);
    const previous = existingByKey.get(key);
    return {
      id: previous?.id || toRecipientId(row.companyName, row.email),
      companyName: row.companyName,
      email: row.email,
      contactName: previous?.contactName,
      status: previous?.status || "sent",
      sentAt: previous?.sentAt || fallbackSentAt,
    };
  });
}

export function RequestsOutboxPanel({
  audience,
}: {
  audience: RequestAudience;
}) {
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [complementDraft, setComplementDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const filtered = listRequests().filter((request) => request.audience === audience);
      setRequests(filtered);
    };
    sync();
    return subscribeRequests(sync);
  }, [audience]);

  const selectedRequestId =
    activeRequestId && requests.some((request) => request.id === activeRequestId)
      ? activeRequestId
      : requests[0]?.id || null;

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const activeRecipientDraft =
    selectedRequest && draftRequestId !== selectedRequest.id
      ? toRecipientEditLines(selectedRequest)
      : recipientDraft;
  const activeComplementDraft =
    selectedRequest && draftRequestId !== selectedRequest.id ? "" : complementDraft;

  const stats = useMemo(() => {
    const sent = requests.filter((request) => request.status === "sent").length;
    const received = requests.filter((request) => request.status === "received").length;
    const recipients = requests.reduce(
      (sum, request) => sum + (request.recipients?.length || request.distribution?.length || 0),
      0
    );
    return { sent, received, recipients };
  }, [requests]);

  const selectedActions = selectedRequest?.scope.actions ?? selectedRequest?.actions ?? [];
  const selectedScopeItems = selectedRequest?.scope.scopeItems ?? [];
  const selectedRecipients = selectedRequest?.recipients ?? [];

  const selectRequest = (requestId: string) => {
    const request = requests.find((item) => item.id === requestId);
    setActiveRequestId(requestId);
    setDraftRequestId(requestId);
    setRecipientDraft(request ? toRecipientEditLines(request) : "");
    setComplementDraft("");
    setNotice(null);
    setError(null);
  };

  const handleSaveSupplement = () => {
    if (!selectedRequest) return;

    const parsedRecipients = parseRecipients(
      activeRecipientDraft,
      selectedRequest.recipients || [],
      selectedRequest.createdAt
    );
    if (parsedRecipients.length === 0) {
      setError("Lägg till minst en entreprenör innan du sparar.");
      setNotice(null);
      return;
    }

    const now = new Date();
    const note = activeComplementDraft.trim();
    const nextScopeItems = [...(selectedRequest.scope.scopeItems || [])];
    if (note.length > 0) {
      nextScopeItems.unshift({
        title: `Komplettering ${now.toLocaleDateString("sv-SE")}`,
        details: note,
      });
    }

    const nextRequest: PlatformRequest = {
      ...selectedRequest,
      status: "sent",
      distribution: parsedRecipients.map((recipient) => toRecipientLabel(recipient)),
      recipients: parsedRecipients,
      scope: {
        ...selectedRequest.scope,
        scopeItems: nextScopeItems,
      },
      missingInfo: selectedRequest.missingInfo.filter(
        (item) => item.toLowerCase().indexOf("mottag") === -1
      ),
    };

    saveRequest(nextRequest);
    setDraftRequestId(selectedRequest.id);
    setRecipientDraft(parsedRecipients.map((recipient) => toRecipientLabel(recipient)).join("\n"));
    setComplementDraft("");
    setError(null);
    setNotice("Förfrågan uppdaterad. Komplettering och mottagare är sparade.");
  };

  const handleMarkReceived = () => {
    if (!selectedRequest) return;
    const nextRequest: PlatformRequest = {
      ...selectedRequest,
      status: selectedRequest.status === "received" ? "sent" : "received",
    };
    saveRequest(nextRequest);
    setNotice(
      nextRequest.status === "received"
        ? "Förfrågan markerad som svar inkommen."
        : "Förfrågan markerad som skickad."
    );
    setError(null);
  };

  if (requests.length === 0) {
    return (
      <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#2A2520]">Mina förfrågningar</h2>
        <p className="mt-2 text-sm text-[#766B60]">
          Inga förfrågningar skickade ännu. När du skickar en förfrågan dyker den upp här
          med status, innehåll och mottagare.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Skickade</p>
          <p className="mt-1 text-2xl font-bold text-[#2A2520]">{stats.sent}</p>
        </article>
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Svar inkomna</p>
          <p className="mt-1 text-2xl font-bold text-[#2A2520]">{stats.received}</p>
        </article>
        <article className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">Mottagare</p>
          <p className="mt-1 text-2xl font-bold text-[#2A2520]">{stats.recipients}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-[#2A2520]">Förfrågningar</h2>
          <div className="space-y-2">
            {requests.map((request) => {
              const isActive = request.id === selectedRequestId;
              const recipientCount = request.recipients?.length || request.distribution?.length || 0;
              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => selectRequest(request.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-[#8C7860] bg-[#F6F0E8]"
                      : "border-[#E8E3DC] bg-white hover:bg-[#FAF8F5]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#2A2520]">{request.title}</p>
                  <p className="mt-1 text-xs text-[#6B5A47]">{request.location}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-[#D9D1C6] bg-[#FAF8F5] px-2 py-0.5 font-semibold text-[#6B5A47]">
                      {toStatusLabel(request.status)}
                    </span>
                    <span className="text-[#766B60]">{formatDate(request.createdAt)}</span>
                    <span className="text-[#766B60]">{recipientCount} mottagare</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {selectedRequest && (
          <main className="space-y-4">
            <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#2A2520]">
                    {selectedRequest.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#6B5A47]">{selectedRequest.location}</p>
                  <p className="mt-1 text-xs text-[#766B60]">Förfrågan-ID: {selectedRequest.id}</p>
                </div>
                <button
                  type="button"
                  onClick={handleMarkReceived}
                  className="rounded-xl border border-[#D2C5B5] bg-white px-4 py-2 text-sm font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  {selectedRequest.status === "received"
                    ? "Markera som skickad"
                    : "Markera svar inkommen"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Status", value: toStatusLabel(selectedRequest.status) },
                  { label: "Budget", value: selectedRequest.budgetRange },
                  { label: "Startfönster", value: selectedRequest.desiredStart },
                  { label: "Underlagsnivå", value: `${selectedRequest.completeness}% komplett` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8C7860]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#2A2520]">{item.value}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#2A2520]">Mottagande entreprenörer</h3>
              {selectedRecipients.length === 0 && (
                <p className="mt-2 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
                  Inga mottagare registrerade ännu.
                </p>
              )}
              {selectedRecipients.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {selectedRecipients.map((recipient) => (
                    <li
                      key={recipient.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-[#2A2520]">{recipient.companyName}</p>
                        <p className="text-xs text-[#6B5A47]">
                          {recipient.email || "E-post saknas"} · skickad {formatDate(recipient.sentAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${recipientStatusClass(recipient.status)}`}
                      >
                        {recipientStatusLabel(recipient.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#2A2520]">Innehåll i förfrågan</h3>
              <p className="mt-2 text-sm text-[#6B5A47]">
                {selectedActions.length} åtgärder · {selectedScopeItems.length} scope-rader ·{" "}
                {selectedRequest.files?.length || 0} filer
              </p>
              <ul className="mt-3 space-y-2">
                {selectedScopeItems.slice(0, 8).map((item, index) => (
                  <li key={`${item.title}-${index}`} className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm">
                    <p className="font-semibold text-[#2A2520]">{item.title}</p>
                    {item.details && <p className="mt-1 text-xs text-[#6B5A47]">{item.details}</p>}
                  </li>
                ))}
                {selectedScopeItems.length === 0 && (
                  <li className="rounded-xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2 text-sm text-[#6B5A47]">
                    Inga scope-rader tillagda ännu.
                  </li>
                )}
              </ul>
            </article>

            <article className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-[#2A2520]">Komplettera förfrågan</h3>
              <p className="mt-1 text-sm text-[#766B60]">
                Lägg till fler mottagare och kompletterande information. Uppdateringen sparas direkt.
              </p>

              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">
                  Entreprenörer (en rad per mottagare)
                </span>
                <textarea
                  value={activeRecipientDraft}
                  onChange={(event) => {
                    setDraftRequestId(selectedRequest.id);
                    setRecipientDraft(event.target.value);
                  }}
                  rows={5}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                  placeholder={"Bolag AB <offert@bolag.se>\nAnnan Entreprenör | anbud@firma.se"}
                />
              </label>

              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-semibold text-[#2A2520]">
                  Kompletterande information till underlaget
                </span>
                <textarea
                  value={activeComplementDraft}
                  onChange={(event) => {
                    setDraftRequestId(selectedRequest.id);
                    setComplementDraft(event.target.value);
                  }}
                  rows={4}
                  className="w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2"
                  placeholder="Exempel: Arbete får endast utföras vardagar 08:00–16:00. Hiss finns ej."
                />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveSupplement}
                  className="rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
                >
                  Spara komplettering
                </button>
                <span className="text-xs text-[#766B60]">
                  Senast skickad: {formatDate(selectedRequest.createdAt)}
                </span>
              </div>

              {error && (
                <p className="mt-3 rounded-xl border border-[#F0E3D0] bg-[#FFF9F1] px-3 py-2 text-sm text-[#6B5A47]">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mt-3 rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
                  {notice}
                </p>
              )}
            </article>
          </main>
        )}
      </section>
    </div>
  );
}
