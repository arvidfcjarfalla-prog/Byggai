import type { PlatformDocument } from "./documents-store";
import type { PlatformRequest } from "./requests-store";

function escapeHtml(value: unknown): string {
  const input = String(value ?? "");
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFieldValue(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nej";
  }
  return escapeHtml(value);
}

function formatTypeLabel(type: PlatformDocument["type"]): string {
  if (type === "quote") return "Offert";
  if (type === "contract") return "Avtal";
  return "ÄTA";
}

function formatStatusLabel(status: PlatformDocument["status"]): string {
  if (status === "sent") return "Skickad";
  if (status === "accepted") return "Accepterad";
  if (status === "rejected") return "Avslog";
  if (status === "superseded") return "Ersatt";
  return "Utkast";
}

export function renderDocumentToHtml(
  document: PlatformDocument,
  request: PlatformRequest | null
): string {
  const enabledSections = document.sections.filter((section) => section.enabled);
  const fileMap = new Map<string, string>();
  (request?.files ?? []).forEach((file) => {
    if (file.id) fileMap.set(file.id, file.name);
  });

  const sectionHtml = enabledSections
    .map((section) => {
      const fieldsHtml = section.fields
        .map(
          (field) =>
            `<div class="doc-row"><div class="doc-label">${escapeHtml(field.label)}</div><div class="doc-value">${renderFieldValue(
              field.value
            )}</div></div>`
        )
        .join("");

      const itemsHtml = (section.items ?? [])
        .map((item) => {
          const parts = [
            item.description ? escapeHtml(item.description) : "",
            typeof item.quantity === "number" ? `Antal: ${escapeHtml(item.quantity)}` : "",
            typeof item.unitPrice === "number" ? `A-pris: ${escapeHtml(item.unitPrice)} SEK` : "",
            typeof item.total === "number" ? `Summa: ${escapeHtml(item.total)} SEK` : "",
            item.value ? escapeHtml(item.value) : "",
          ].filter((part) => part.length > 0);

          return `<li><strong>${escapeHtml(item.label)}</strong>${parts.length > 0 ? `<div>${parts.join(" | ")}</div>` : ""}</li>`;
        })
        .join("");

      const attachmentsHtml =
        section.title.toLowerCase().includes("bilag") && document.linkedFileIds.length > 0
          ? `<ul>${document.linkedFileIds
              .map((fileId) => `<li>${escapeHtml(fileMap.get(fileId) ?? fileId)}</li>`)
              .join("")}</ul>`
          : "";

      return `
<section class="doc-section">
  <h2>${escapeHtml(section.title)}</h2>
  ${section.description ? `<p class="doc-description">${escapeHtml(section.description)}</p>` : ""}
  ${fieldsHtml.length > 0 ? `<div class="doc-grid">${fieldsHtml}</div>` : ""}
  ${itemsHtml.length > 0 ? `<ul class="doc-items">${itemsHtml}</ul>` : ""}
  ${attachmentsHtml}
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(document.title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Helvetica Neue", Arial, sans-serif; margin: 0; background: #f4f2ee; color: #2a2520; }
    .doc-wrap { max-width: 860px; margin: 24px auto; background: #fff; border: 1px solid #e6dfd6; border-radius: 16px; padding: 24px; }
    .doc-meta { font-size: 12px; color: #6b5a47; margin-bottom: 16px; display: flex; gap: 16px; flex-wrap: wrap; }
    .doc-section { margin-top: 22px; border-top: 1px solid #eee7dc; padding-top: 16px; }
    .doc-section h2 { font-size: 18px; margin: 0 0 10px; }
    .doc-description { margin: 0 0 10px; color: #6b5a47; }
    .doc-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .doc-row { border: 1px solid #eee7dc; border-radius: 10px; padding: 8px 10px; background: #fcfbf8; }
    .doc-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: #6b5a47; }
    .doc-value { margin-top: 4px; font-size: 14px; white-space: pre-wrap; }
    .doc-items { margin: 8px 0 0; padding-left: 18px; }
    .doc-items li { margin-top: 6px; }
    @media print {
      body { background: #fff; }
      .doc-wrap { margin: 0; border: 0; border-radius: 0; max-width: none; padding: 0; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <article class="doc-wrap">
    <h1>${escapeHtml(document.title)}</h1>
    <div class="doc-meta">
      <span>Typ: ${formatTypeLabel(document.type)}</span>
      <span>Status: ${formatStatusLabel(document.status)}</span>
      <span>Version: ${escapeHtml(document.version)}</span>
      <span>Request: ${escapeHtml(document.requestId)}</span>
      <span>Uppdaterad: ${escapeHtml(new Date(document.updatedAt).toLocaleString("sv-SE"))}</span>
    </div>
    ${sectionHtml}
  </article>
</body>
</html>`;
}
