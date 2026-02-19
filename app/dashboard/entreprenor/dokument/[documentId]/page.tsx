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

export default function EntreprenorDocumentEditorPage() {
  const params = useParams<{ documentId: string }>();
  const router = useRouter();
  const { user, ready } = useAuth();
  const documentId = params.documentId;

  const [document, setDocument] = useState<PlatformDocument | null>(null);
  const [request, setRequest] = useState<PlatformRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const setLinkedFile = (fileId: string, enabled: boolean) => {
    setDocument((current) => {
      if (!current) return current;
      const linkedFileIds = enabled
        ? Array.from(new Set([...current.linkedFileIds, fileId]))
        : current.linkedFileIds.filter((id) => id !== fileId);
      return {
        ...current,
        linkedFileIds,
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

  const persist = (nextStatus?: PlatformDocument["status"]) => {
    if (!document) return;
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

    saveDocument(withRender);
    setDocument(withRender);
    setNotice(nextStatus === "sent" ? "Dokument skickat till inkorg." : "Dokument sparat.");
  };

  const handleCreateNextVersion = () => {
    const next = createNextVersion(document.id);
    if (!next) return;
    setNotice("Ny version skapad.");
    router.push(`/dashboard/entreprenor/dokument/${next.id}`);
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
      ]}
      cards={[]}
    >
      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <aside className="space-y-4 rounded-3xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-[#6B5A47]">Dokumenttitel</label>
            <input
              value={document.title}
              onChange={(event) => setDocument({ ...document, title: event.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D9D1C6] bg-white px-3 py-2 text-sm text-[#2A2520]"
            />
          </div>

          <div className="rounded-2xl border border-[#E8E3DC] bg-[#FAF8F5] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B5A47]">Bilagor</p>
            {(request?.files?.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-[#766B60]">Inga bilagor kopplade till förfrågan.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {(request?.files ?? []).map((file) => {
                  if (!file.id) return null;
                  const checked = document.linkedFileIds.includes(file.id);
                  return (
                    <li key={file.id}>
                      <label className="flex items-center gap-2 rounded-lg border border-[#E8E3DC] bg-white px-2 py-1.5 text-xs text-[#2A2520]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setLinkedFile(file.id as string, event.target.checked)}
                        />
                        <span className="truncate">{file.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            {document.sections.map((section) => (
              <article key={section.id} className="rounded-2xl border border-[#E8E3DC] bg-[#FCFBF8] p-3">
                <label className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-[#2A2520]">
                  <span>{section.title}</span>
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(event) => setSectionEnabled(section.id, event.target.checked)}
                  />
                </label>

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
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B5A47]">Rad</p>
                      <input
                        value={item.label}
                        onChange={(event) => setItemValue(section.id, item.id, "label", event.target.value)}
                        className="mb-1 w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                        placeholder="Rubrik"
                      />
                      <input
                        value={item.value ?? ""}
                        onChange={(event) => setItemValue(section.id, item.id, "value", event.target.value)}
                        className="mb-1 w-full rounded-md border border-[#D9D1C6] px-2 py-1 text-xs"
                        placeholder="Varde/kommentar"
                      />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[#E8E3DC] pt-3">
            <button
              type="button"
              onClick={() => persist()}
              className="rounded-xl bg-[#8C7860] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B5A47]"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={handleCreateNextVersion}
              className="rounded-xl border border-[#D2C5B5] bg-white px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#F6F0E8]"
            >
              Skapa ny version
            </button>
            <button
              type="button"
              onClick={() => persist("sent")}
              className="rounded-xl border border-[#8C7860] bg-[#F6F0E8] px-3 py-2 text-xs font-semibold text-[#6B5A47] hover:bg-[#EFE4D6]"
            >
              Skicka till inkorg
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
