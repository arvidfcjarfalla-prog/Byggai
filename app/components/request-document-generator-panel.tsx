"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createDocumentFromTemplate,
  saveDocument,
  type DocumentField,
  type DocumentAttachmentRef,
  type DocumentPromptPayload,
  type DocumentType,
} from "../lib/documents-store";
import {
  generateAndStoreDocumentPdf,
  shareDocumentPdfToRecipient,
} from "../lib/project-files/document-integration";
import { listFiles } from "../lib/project-files/store";
import type { PlatformRequest } from "../lib/requests-store";
import { sendRequestMessage } from "../lib/request-messages";
import { AttachmentPicker } from "./attachments/attachment-picker";

interface RequestDocumentGeneratorPanelProps {
  request: PlatformRequest;
  actorLabel: string;
  onDocumentSent?: () => void;
}

const DOCUMENT_OPTIONS: Array<{ kind: DocumentType; label: string }> = [
  { kind: "quote", label: "Offert" },
  { kind: "contract", label: "Avtal" },
  { kind: "ate", label: "ÄTA" },
];

function typeLabel(type: DocumentType): string {
  return DOCUMENT_OPTIONS.find((option) => option.kind === type)?.label ?? "Dokument";
}

function applyFieldOverride(
  fields: DocumentField[],
  fieldId: string,
  value: string | number | boolean
): DocumentField[] {
  const next = fields.map((field) => (field.id === fieldId ? { ...field, value } : field));
  return next;
}

function upsertField(
  fields: DocumentField[],
  field: DocumentField
): DocumentField[] {
  if (fields.some((entry) => entry.id === field.id)) {
    return applyFieldOverride(fields, field.id, field.value);
  }
  return [...fields, field];
}

function buildDerivedSummary(request: PlatformRequest): string {
  const actionsCount = request.scope.actions?.length ?? 0;
  const scopeCount = request.scope.scopeItems?.length ?? 0;
  const filesCount = request.files?.length ?? 0;
  return [
    `Projekt: ${request.title}`,
    `Plats: ${request.location}`,
    `Målstart: ${request.desiredStart}`,
    `Budget: ${request.budgetRange}`,
    `Omfattning: ${scopeCount} scope-punkter, ${actionsCount} åtgärder`,
    `Underlag: ${filesCount} filer`,
  ].join(" | ");
}

function toPromptPayload(input: {
  request: PlatformRequest;
  selectedSectionIds: string[];
  entrepreneurInputs: {
    priceSummary: string;
    paymentPlan: string;
    terms: string;
    reservations: string;
  };
}): DocumentPromptPayload {
  const { request, selectedSectionIds, entrepreneurInputs } = input;
  return {
    generatedAt: new Date().toISOString(),
    selectedSectionIds,
    entrepreneurInputs: {
      priceSummary: entrepreneurInputs.priceSummary || undefined,
      paymentPlan: entrepreneurInputs.paymentPlan || undefined,
      terms: entrepreneurInputs.terms || undefined,
      reservations: entrepreneurInputs.reservations || undefined,
    },
    requestContext: {
      id: request.id,
      title: request.title,
      audience: request.audience,
      location: request.location,
      desiredStart: request.desiredStart,
      budgetRange: request.budgetRange,
      scope: request.scope,
      snapshot: request.snapshot,
      propertySnapshot: request.propertySnapshot,
      documentSummary: request.documentSummary,
      filesSummary: (request.files ?? []).map((file) => ({
        id: file.id,
        name: file.name,
        fileTypeLabel: file.fileTypeLabel,
        tags: file.tags,
        linkedActionTitle: file.linkedActionTitle,
      })),
      derivedSummary: buildDerivedSummary(request),
    },
  };
}

export function RequestDocumentGeneratorPanel({
  request,
  actorLabel,
  onDocumentSent,
}: RequestDocumentGeneratorPanelProps) {
  const [kind, setKind] = useState<DocumentType>("quote");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [priceSummary, setPriceSummary] = useState("");
  const [paymentPlan, setPaymentPlan] = useState("");
  const [terms, setTerms] = useState("");
  const [reservations, setReservations] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftTemplate = useMemo(
    () => createDocumentFromTemplate(request, kind, "entreprenor", actorLabel),
    [actorLabel, kind, request]
  );
  const sectionDefaults = useMemo(
    () =>
      draftTemplate.sections
        .filter((section) => section.enabled)
        .map((section) => section.id),
    [draftTemplate]
  );

  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setSelectedSectionIds(sectionDefaults);
  }, [sectionDefaults]);

  const handleCreate = async () => {
    setIsCreating(true);
    setNotice(null);
    setError(null);
    try {
      const projectFiles = await listFiles(request.id, undefined, undefined, "entreprenor");
      const byId = new Map(projectFiles.map((file) => [file.id, file]));
      const attachments: DocumentAttachmentRef[] = selectedFileIds
        .map((fileId) => byId.get(fileId))
        .filter((file): file is (typeof projectFiles)[number] => Boolean(file))
        .map((file) => ({
          fileId: file.id,
          fileRefId: file.refId,
          filename: file.filename,
          folder: file.folder,
          mimeType: file.mimeType,
        }));

      const selectedSectionsSet = new Set(selectedSectionIds);
      const sectionsWithSelection = draftTemplate.sections.map((section) => ({
        ...section,
        enabled: selectedSectionsSet.has(section.id),
      }));

      const sectionsWithInputs = sectionsWithSelection.map((section) => {
        let fields = section.fields;
        if (priceSummary.trim().length > 0) {
          fields = applyFieldOverride(fields, "total-price", priceSummary.trim());
          fields = applyFieldOverride(fields, "compensation", priceSummary.trim());
          fields = applyFieldOverride(fields, "price-total", priceSummary.trim());
        }
        if (terms.trim().length > 0) {
          fields = applyFieldOverride(fields, "terms", terms.trim());
          fields = applyFieldOverride(fields, "extra-agreements", terms.trim());
        }
        if (reservations.trim().length > 0) {
          fields = applyFieldOverride(fields, "reservation-text", reservations.trim());
          fields = applyFieldOverride(fields, "price-comment", reservations.trim());
        }
        if (
          paymentPlan.trim().length > 0 &&
          (section.id === "pricing" || section.id === "payment" || section.id === "kov-pricing")
        ) {
          fields = upsertField(fields, {
            id: "payment-plan-custom",
            label: "Betalningsplan",
            type: "textarea",
            value: paymentPlan.trim(),
          });
        }

        return {
          ...section,
          fields,
        };
      });

      const promptPayload = toPromptPayload({
        request,
        selectedSectionIds,
        entrepreneurInputs: {
          priceSummary,
          paymentPlan,
          terms,
          reservations,
        },
      });

      const next = {
        ...draftTemplate,
        status: "sent" as const,
        linkedFileIds: selectedFileIds,
        linkedRefs: attachments
          .map((entry) => entry.fileRefId)
          .filter((ref) => ref.trim().length > 0),
        attachments,
        sections: sectionsWithInputs,
        documentPromptPayload: promptPayload,
      };

      const savedInitial = saveDocument(next).find((entry) => entry.id === next.id) ?? next;
      const storedPdf = await generateAndStoreDocumentPdf({
        document: savedInitial,
        request,
        createdBy: actorLabel,
        senderRole: "entreprenor",
        senderWorkspaceId: "entreprenor",
      });
      await shareDocumentPdfToRecipient({
        document: savedInitial,
        senderLabel: actorLabel,
        senderRole: "entreprenor",
        senderWorkspaceId: "entreprenor",
      });

      const savedWithPdf = {
        ...savedInitial,
        linkedFileIds: Array.from(
          new Set([...savedInitial.linkedFileIds, storedPdf.id])
        ),
        linkedRefs: Array.from(
          new Set([
            ...(savedInitial.linkedRefs ?? []),
            savedInitial.refId,
            storedPdf.refId,
          ])
        ),
        attachments: [
          ...savedInitial.attachments.filter((entry) => entry.fileId !== storedPdf.id),
          {
            fileId: storedPdf.id,
            fileRefId: storedPdf.refId,
            filename: storedPdf.filename,
            folder: storedPdf.folder,
            mimeType: storedPdf.mimeType,
          },
        ],
      };
      const persisted =
        saveDocument(savedWithPdf).find((entry) => entry.id === savedWithPdf.id) ??
        savedWithPdf;

      sendRequestMessage({
        requestId: request.id,
        authorRole: "entreprenor",
        authorLabel: actorLabel,
        messageType: "document",
        relatedDocumentId: persisted.id,
        relatedDocumentRefId: persisted.refId,
        relatedFileId: storedPdf.id,
        targetRoles: [request.audience === "brf" ? "brf" : "privatperson"],
        body: [
          `${typeLabel(kind)} skickad.`,
          `Dokument: ${persisted.title}`,
          `Dokument-ID: ${persisted.id}`,
          `RefID: ${persisted.refId}`,
          `PDF-fil: ${storedPdf.filename}`,
        ].join("\n"),
      });

      setNotice(`${typeLabel(kind)} skickad. PDF och relaterade filer är kopplade till projektet.`);
      onDocumentSent?.();
      setSelectedSectionIds(sectionDefaults);
      setPriceSummary("");
      setPaymentPlan("");
      setTerms("");
      setReservations("");
      setSelectedFileIds([]);
    } catch (error) {
      const fallback = "Kunde inte skapa och skicka dokumentet.";
      setError(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#E6DFD6] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-[#2A2520]">Skapa och skicka projektbundet dokument</h3>
      <p className="mt-1 text-sm text-[#766B60]">
        Dokument sparas per förfrågan, får PDF i projektets filer och skickas till mottagarens dokumentinkorg.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
          <label className="block text-xs font-semibold text-[#6B5A47]">
            Dokumenttyp
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as DocumentType)}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            >
              {DOCUMENT_OPTIONS.map((option) => (
                <option key={option.kind} value={option.kind}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-[#E8E3DC] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">
              Sektioner
            </p>
            <div className="mt-2 space-y-1.5">
              {draftTemplate.sections.map((section) => {
                const checked = selectedSectionIds.includes(section.id);
                return (
                  <label
                    key={section.id}
                    className="flex items-center gap-2 rounded-lg border border-[#EFE8DD] bg-[#FCFBF8] px-2 py-1.5 text-xs text-[#2A2520]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedSectionIds((current) =>
                            Array.from(new Set([...current, section.id]))
                          );
                        } else {
                          setSelectedSectionIds((current) =>
                            current.filter((entry) => entry !== section.id)
                          );
                        }
                      }}
                    />
                    <span className="truncate">{section.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#E8E3DC] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">
              Entreprenörsinput
            </p>
            <div className="mt-2 space-y-2">
              <label className="block text-[11px] font-semibold text-[#6B5A47]">
                Pris
                <input
                  value={priceSummary}
                  onChange={(event) => setPriceSummary(event.target.value)}
                  placeholder="Ex: 475 000 kr inkl. moms"
                  className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                />
              </label>
              <label className="block text-[11px] font-semibold text-[#6B5A47]">
                Betalningsplan
                <textarea
                  value={paymentPlan}
                  onChange={(event) => setPaymentPlan(event.target.value)}
                  rows={2}
                  placeholder="Ex: 30% vid start, 40% efter halvtid, 30% vid slutbesiktning"
                  className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                />
              </label>
              <label className="block text-[11px] font-semibold text-[#6B5A47]">
                Villkor
                <textarea
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  rows={2}
                  placeholder="Ex: 30 dagar netto, material enligt godkänd lista"
                  className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                />
              </label>
              <label className="block text-[11px] font-semibold text-[#6B5A47]">
                Reservationer
                <textarea
                  value={reservations}
                  onChange={(event) => setReservations(event.target.value)}
                  rows={2}
                  placeholder="Ex: Gäller under förutsättning att underlag stämmer"
                  className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                />
              </label>
            </div>
          </div>

          <AttachmentPicker
            projectId={request.id}
            selectedFileIds={selectedFileIds}
            onChange={setSelectedFileIds}
            workspaceId="entreprenor"
          />

          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full rounded-xl bg-[#8C7860] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B5A47]"
          >
            {isCreating ? "Genererar..." : "Generera och skicka"}
          </button>
        </div>

        <article className="rounded-2xl border border-[#E8E3DC] bg-[#FCFBF8] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">Preview av payload</p>
          <div className="mt-2 rounded-xl border border-[#EFE8DD] bg-white p-3 text-xs text-[#2A2520]">
            <p className="font-semibold">{draftTemplate.title}</p>
            <p className="mt-1 text-[#6B5A47]">Typ: {typeLabel(kind)}</p>
            <p className="text-[#6B5A47]">Sektioner valda: {selectedSectionIds.length} / {draftTemplate.sections.length}</p>
            <p className="text-[#6B5A47]">Bilagor valda: {selectedFileIds.length} st</p>
            <p className="text-[#6B5A47]">Request: {request.id}</p>
            <p className="mt-2 text-[#766B60]">
              Payload inkluderar request-snapshot, scope, filsammanfattning, valda sektioner och entreprenörsinput.
            </p>
          </div>
        </article>
      </div>

      {notice && (
        <p className="mt-3 rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-[#F0D8D8] bg-[#FFF5F5] px-3 py-2 text-sm text-[#8A4242]">
          {error}
        </p>
      )}
    </section>
  );
}
