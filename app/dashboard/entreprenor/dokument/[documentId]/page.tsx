"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard-shell";
import { useAuth } from "../../../../components/auth-context";
import {
  createNextVersion,
  getDocumentById,
  saveDocument,
  subscribeDocuments,
  type DocumentField,
  type PlatformDocument,
} from "../../../../lib/documents-store";
import { renderDocumentToHtml } from "../../../../lib/document-renderer";
import {
  generateAndStoreDocumentPdf,
  shareDocumentPdfToRecipient,
} from "../../../../lib/project-files/document-integration";
import { listFiles, subscribeProjectFiles } from "../../../../lib/project-files/store";
import type { ProjectFile } from "../../../../lib/project-files/types";
import { listRequests, subscribeRequests, type PlatformRequest } from "../../../../lib/requests-store";

function fieldValueToString(value: DocumentField["value"]): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "");
}

function statusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslog";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

function hasFieldValue(value: DocumentField["value"]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  return String(value ?? "").trim().length > 0;
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => entry === right[index]);
}

export default function EntreprenorDocumentEditorPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const { user, ready } = useAuth();
  const documentId = params.documentId;

  const [document, setDocument] = useState<PlatformDocument | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([]);
  const [expandedItemKeys, setExpandedItemKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "entreprenor") {
      router.replace(user.role === "brf" ? "/dashboard/brf" : "/dashboard/privat");
    }
  }, [ready, router, user]);

  useEffect(() => {
    const sync = () => {
      const loadedDoc = getDocumentById(documentId);
      setDocument(loadedDoc);
      if (!loadedDoc) {
        setRequest(null);
        return;
      }
      const relatedRequest = listRequests().find((entry) => entry.id === loadedDoc.requestId) ?? null;
      setRequest(relatedRequest);
    };

    sync();
    const unsubDocuments = subscribeDocuments(sync);
    const unsubRequests = subscribeRequests(sync);
    return () => {
      unsubDocuments();
      unsubRequests();
    };
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (!document?.requestId) {
        if (!cancelled) setProjectFiles([]);
        return;
      }
      try {
        const files = await listFiles(document.requestId, undefined, undefined, "entreprenor");
        if (!cancelled) {
          setProjectFiles(files);
        }
      } catch {
        if (!cancelled) {
          setProjectFiles([]);
        }
      }
    };

    void sync();
    const unsubscribe = subscribeProjectFiles(() => {
      void sync();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [document?.requestId]);

  useEffect(() => {
    if (!document || projectFiles.length === 0) return;
    if (document.attachments.length >= document.linkedFileIds.length) return;

    const byId = new Map(projectFiles.map((file) => [file.id, file]));
    const nextAttachments = document.linkedFileIds
      .map((fileId) => byId.get(fileId))
      .filter((file): file is ProjectFile => Boolean(file))
      .map((file) => ({
        fileId: file.id,
        fileRefId: file.refId,
        filename: file.filename,
        folder: file.folder,
        mimeType: file.mimeType,
      }));

    if (nextAttachments.length === 0) return;
    setDocument({
      ...document,
      attachments: nextAttachments,
    });
  }, [document, projectFiles]);

  const sectionIds = useMemo(
    () => (document ? document.sections.map((section) => section.id) : []),
    [document]
  );

  useEffect(() => {
    if (!document?.id) return;
    setExpandedSectionIds((current) => {
      const existing = current.filter((id) => sectionIds.includes(id));
      const next = existing.length > 0 ? existing : sectionIds.slice(0, 2);
      return sameStringArray(current, next) ? current : next;
    });
  }, [document?.id, sectionIds]);

  const previewHtml = useMemo(() => {
    if (!document) return "";
    return renderDocumentToHtml(document, request);
  }, [document, request]);

  if (!ready || !user) return null;

  if (!document) {
    return (
      <DashboardShell
        roleLabel="Entreprenör"
        heading="Dokumenteditor"
        subheading="Dokumentet kunde inte hittas."
        cards={[]}
      >
        <section className="rounded-3xl border border-[#E6DFD6] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#766B60]">Dokumentet finns inte eller har tagits bort.</p>
        </section>
      </DashboardShell>
    );
  }

  const setFieldValue = (sectionId: string, fieldId: string, nextValue: string | number | boolean) => {
    setDocument((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                fields: section.fields.map((field) =>
                  field.id === fieldId ? { ...field, value: nextValue } : field
                ),
              }
            : section
        ),
      };
    });
  };

  const setSectionEnabled = (sectionId: string, enabled: boolean) => {
    setDocument((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, enabled } : section
        ),
      };
    });
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    );
  };

  const expandAllSections = () => {
    setExpandedSectionIds(document.sections.map((section) => section.id));
  };

  const collapseAllSections = () => {
    setExpandedSectionIds([]);
  };

  const setLinkedFile = (file: ProjectFile, enabled: boolean) => {
    setDocument((current) => {
      if (!current) return current;
      const linkedFileIds = enabled
        ? Array.from(new Set([...current.linkedFileIds, file.id]))
        : current.linkedFileIds.filter((id) => id !== file.id);

      const attachments = enabled
        ? [
            ...current.attachments.filter((entry) => entry.fileId !== file.id),
            {
              fileId: file.id,
              fileRefId: file.refId,
              filename: file.filename,
              folder: file.folder,
              mimeType: file.mimeType,
            },
          ]
        : current.attachments.filter((entry) => entry.fileId !== file.id);

      return {
        ...current,
        linkedFileIds,
        attachments,
      };
    });
  };

  const setItemValue = (
    sectionId: string,
    itemId: string,
    key: "label" | "description" | "value" | "quantity" | "unitPrice" | "total",
    nextValue: string
  ) => {
    setDocument((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.id !== sectionId || !section.items) return section;
          return {
            ...section,
            items: section.items.map((item) => {
              if (item.id !== itemId) return item;
              if (key === "quantity" || key === "unitPrice" || key === "total") {
                const parsed = nextValue.trim().length > 0 ? Number(nextValue) : undefined;
                return {
                  ...item,
                  [key]: parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined,
                };
              }
              return {
                ...item,
                [key]: nextValue,
              };
            }),
          };
        }),
      };
    });
  };

  const toggleItemExpanded = (sectionId: string, itemId: string) => {
    const key = `${sectionId}:${itemId}`;
    setExpandedItemKeys((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  };

  const persist = async (nextStatus?: PlatformDocument["status"]) => {
    if (!document) return;
    setIsBusy(true);
    const withRender: PlatformDocument = {
      ...document,
      status: nextStatus ?? document.status,
      renderedHtml: renderDocumentToHtml(
        {
          ...document,
          status: nextStatus ?? document.status,
        },
        request
      ),
    };

    try {
      const saved = saveDocument(withRender).find((entry) => entry.id === withRender.id) ?? withRender;
      await generateAndStoreDocumentPdf({
        document: saved,
        request,
        createdBy: saved.createdByLabel,
        senderRole: saved.createdByRole,
        senderWorkspaceId: "entreprenor",
      });
      setDocument(saved);
      setNotice(nextStatus === "sent" ? "Dokument skickat till inkorg." : "Dokument sparat och PDF uppdaterad i Filer.");
    } catch (error) {
      const fallback = "Kunde inte spara dokument-PDF.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateNextVersion = async () => {
    const next = createNextVersion(document.id);
    if (!next) return;
    setIsBusy(true);
    try {
      await generateAndStoreDocumentPdf({
        document: next,
        request,
        createdBy: next.createdByLabel,
        senderRole: next.createdByRole,
        senderWorkspaceId: "entreprenor",
      });
      setNotice("Ny version skapad och PDF tillagd i Filer.");
      router.push(`/dashboard/entreprenor/dokument/${next.id}`);
    } catch (error) {
      const fallback = "Ny version skapades, men PDF kunde inte genereras.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendToCustomer = async () => {
    setIsBusy(true);
    try {
      const withRender: PlatformDocument = {
        ...document,
        status: "sent",
        renderedHtml: renderDocumentToHtml(
          {
            ...document,
            status: "sent",
          },
          request
        ),
      };
      const saved = saveDocument(withRender).find((entry) => entry.id === withRender.id) ?? withRender;
      await generateAndStoreDocumentPdf({
        document: saved,
        request,
        createdBy: saved.createdByLabel,
        senderRole: saved.createdByRole,
        senderWorkspaceId: "entreprenor",
      });
      await shareDocumentPdfToRecipient({
        document: saved,
        senderLabel: saved.createdByLabel,
        senderRole: saved.createdByRole,
        senderWorkspaceId: "entreprenor",
      });
      setDocument(saved);
      setNotice("PDF skickad till kundens Filer.");
    } catch (error) {
      const fallback = "Kunde inte skicka PDF till kund.";
      setNotice(error instanceof Error && error.message ? error.message : fallback);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DashboardShell
      roleLabel="Entreprenör"
      heading="Dokumenteditor"
      subheading={`${document.title} · v${document.version} · ${statusLabel(document.status)}`}
      startProjectHref="/dashboard/entreprenor/dokument"
      startProjectLabel="Till dokumentöversikt"
      navItems={[
        { href: "/dashboard/entreprenor", label: "Översikt" },
        { href: "/dashboard/entreprenor/forfragningar", label: "Se förfrågningar" },
        { href: "/dashboard/entreprenor/meddelanden", label: "Meddelanden" },
        { href: "/dashboard/entreprenor/dokument", label: "Dokumentgenerator" },
        { href: "/dashboard/entreprenor/filer", label: "Filer" },
      ]}
      cards={[]}
    >
      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <aside className="max-h-[80vh] space-y-4 overflow-y-auto rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-[#6B5A47]">Dokumenttitel</label>
            <input
              value={document.title}
              onChange={(event) => setDocument({ ...document, title: event.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            />
          </div>
          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B5A47]">RefID</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-mono text-xs text-[#2A2520]">{document.refId}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(document.refId);
                  setNotice("RefID kopierad.");
                }}
                className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
              >
                Kopiera
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">Bilagor</p>
            {projectFiles.length === 0 ? (
              <p className="mt-2 text-xs text-[#766B60]">Inga bilagor kopplade till förfrågan.</p>
            ) : (
              <details className="mt-2 overflow-hidden rounded-xl border border-[#E8E3DC] bg-white">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#6B5A47]">
                  Bilagor ({document.linkedFileIds.length} av {projectFiles.length} valda)
                </summary>
                <ul className="max-h-56 space-y-1 overflow-y-auto border-t border-[#E8E3DC] p-2">
                  {projectFiles.map((file) => {
                    const checked = document.linkedFileIds.includes(file.id);
                    return (
                      <li key={file.id}>
                        <label className="flex items-center gap-2 rounded-lg border border-[#E8E3DC] bg-white px-2 py-1.5 text-xs text-[#2A2520]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => setLinkedFile(file, event.target.checked)}
                          />
                          <span className="min-w-0 flex-1 truncate">{file.filename}</span>
                          <span className="font-mono text-[10px] text-[#6B5A47]">{file.refId}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B5A47]">
                Sektioner ({document.sections.length})
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllSections}
                  className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Expandera alla
                </button>
                <button
                  type="button"
                  onClick={collapseAllSections}
                  className="rounded-lg border border-[#D2C5B5] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                >
                  Fäll ihop
                </button>
              </div>
            </div>
            {document.sections.map((section) => (
              <article key={section.id} className="rounded-2xl border border-[#E8E3DC] bg-[#FCFBF8] p-3">
                {(() => {
                  const isExpanded = expandedSectionIds.includes(section.id);
                  const filledFieldCount = section.fields.filter((field) => hasFieldValue(field.value)).length;
                  const itemCount = section.items?.length ?? 0;

                  return (
                    <>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSectionExpanded(section.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-[#E8E3DC] bg-white px-2 py-1.5 text-left text-sm font-semibold text-[#2A2520] hover:bg-[#F6F0E8]"
                        >
                          <span className="truncate">{section.title}</span>
                          <span className="text-xs text-[#6B5A47]">{isExpanded ? "▲" : "▼"}</span>
                        </button>
                        <label className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E8E3DC] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B5A47]">
                          Aktiv
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={(event) => setSectionEnabled(section.id, event.target.checked)}
                          />
                        </label>
                      </div>

                      {!isExpanded ? (
                        <p className="text-[11px] text-[#766B60]">
                          {filledFieldCount}/{section.fields.length} fält ifyllda
                          {itemCount > 0 ? ` · ${itemCount} rader` : ""}
                        </p>
                      ) : (
                        <div className="space-y-2">
                  {section.fields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B5A47]">
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={fieldValueToString(field.value)}
                          onChange={(event) => setFieldValue(section.id, field.id, event.target.value)}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                        />
                      ) : field.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(event) => setFieldValue(section.id, field.id, event.target.checked)}
                          className="mt-1"
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={fieldValueToString(field.value)}
                          onChange={(event) => setFieldValue(section.id, field.id, event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={`${field.id}-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          value={fieldValueToString(field.value)}
                          onChange={(event) =>
                            setFieldValue(
                              section.id,
                              field.id,
                              field.type === "number"
                                ? Number(event.target.value || 0)
                                : event.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-[#D9D1C6] bg-white px-2 py-1.5 text-xs text-[#2A2520]"
                        />
                      )}
                    </div>
                  ))}

                  {(section.items ?? []).map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#E8E3DC] bg-white p-2">
                      {(() => {
                        const itemKey = `${section.id}:${item.id}`;
                        const itemExpanded = expandedItemKeys.includes(itemKey);
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleItemExpanded(section.id, item.id)}
                              className="mb-1 flex w-full items-center justify-between rounded-md border border-[#E8E3DC] bg-[#FAF8F5] px-2 py-1 text-left text-[11px] font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
                            >
                              <span className="truncate">{item.label || "Rad"}</span>
                              <span>{itemExpanded ? "▲" : "▼"}</span>
                            </button>

                            {itemExpanded && (
                              <>
                                <input
                                  value={item.label}
                                  onChange={(event) => setItemValue(section.id, item.id, "label", event.target.value)}
                                  className="mb-1 w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                                  placeholder="Rubrik"
                                />
                                <input
                                  value={item.description ?? ""}
                                  onChange={(event) =>
                                    setItemValue(section.id, item.id, "description", event.target.value)
                                  }
                                  className="mb-1 w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                                  placeholder="Källa/ref"
                                />
                                <div className="mb-1 grid grid-cols-3 gap-1">
                                  <input
                                    value={item.quantity ?? ""}
                                    onChange={(event) =>
                                      setItemValue(section.id, item.id, "quantity", event.target.value)
                                    }
                                    className="w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                                    placeholder="Antal"
                                    inputMode="decimal"
                                  />
                                  <input
                                    value={item.unitPrice ?? ""}
                                    onChange={(event) =>
                                      setItemValue(section.id, item.id, "unitPrice", event.target.value)
                                    }
                                    className="w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                                    placeholder="A-pris"
                                    inputMode="decimal"
                                  />
                                  <input
                                    value={item.total ?? ""}
                                    onChange={(event) =>
                                      setItemValue(section.id, item.id, "total", event.target.value)
                                    }
                                    className="w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                                    placeholder="Summa"
                                    inputMode="decimal"
                                  />
                                </div>
                                <input
                                  value={item.value ?? ""}
                                  onChange={(event) => setItemValue(section.id, item.id, "value", event.target.value)}
                                  className="mb-1 w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                                  placeholder="Notering/kommentar"
                                />
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[#E8E3DC] pt-3">
            <button
              type="button"
              onClick={() => void persist()}
              disabled={isBusy}
              className="rounded-xl bg-[#8C7860] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B5A47]"
            >
              {isBusy ? "Arbetar..." : "Spara"}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateNextVersion()}
              disabled={isBusy}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Skapa ny version
            </button>
            <button
              type="button"
              onClick={() => void handleSendToCustomer()}
              disabled={isBusy}
              className="rounded-xl border border-[#8C7860] bg-[#F6F0E8] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#EFE4D6]"
            >
              Skicka PDF
            </button>
          </div>

          {notice && (
            <p className="rounded-xl border border-[#CFE0F0] bg-[#EAF3FB] px-3 py-2 text-sm text-[#314A60]">
              {notice}
            </p>
          )}
        </aside>

        <article className="rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <h3 className="text-lg font-bold text-[#2A2520]">Live preview</h3>
          <p className="mt-1 text-sm text-[#766B60]">Förhandsvisning av aktiverade sektioner (print-ready).</p>
          <div className="mt-3 h-[80vh] overflow-hidden rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5]">
            <iframe
              title="Dokument preview"
              className="h-full w-full"
              srcDoc={previewHtml}
            />
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
