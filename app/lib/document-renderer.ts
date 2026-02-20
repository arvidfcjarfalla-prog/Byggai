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

function formatDateSv(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("sv-SE");
}

function formatNumberSv(value: number): string {
  return new Intl.NumberFormat("sv-SE").format(value);
}

function formatCurrencySv(value: number): string {
  return `${new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: 0,
  }).format(value)} kr`;
}

function formatFieldValue(field: PlatformDocument["sections"][number]["fields"][number]): string {
  if (field.type === "checkbox") return field.value ? "Ja" : "Nej";
  if (field.type === "number") {
    return typeof field.value === "number" ? formatNumberSv(field.value) : String(field.value ?? "");
  }
  if (field.type === "date") {
    return typeof field.value === "string" && field.value.trim() ? formatDateSv(field.value) : "";
  }
  if (field.type === "select") {
    const selected = field.options?.find((option) => option.value === String(field.value ?? ""));
    return selected?.label ?? String(field.value ?? "");
  }
  return String(field.value ?? "");
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

function extractEntrepreneurOrgNumber(document: PlatformDocument): string {
  const fromExplicit = document.sections
    .flatMap((section) => section.fields)
    .find((field) => {
      const key = `${field.id} ${field.label}`.toLowerCase();
      return key.includes("org") || key.includes("organisationsnummer");
    });

  if (fromExplicit && typeof fromExplicit.value === "string" && fromExplicit.value.trim().length > 0) {
    return fromExplicit.value.trim();
  }

  const orgPattern = /\b\d{6}[- ]?\d{4}\b|\b\d{10}\b|\b\d{12}\b/;
  const fromAnyField = document.sections
    .flatMap((section) => section.fields)
    .find((field) => typeof field.value === "string" && orgPattern.test(field.value));

  if (fromAnyField && typeof fromAnyField.value === "string") {
    return fromAnyField.value.match(orgPattern)?.[0] ?? "Ej angivet";
  }

  return "Ej angivet";
}

function renderItemsTable(
  items: PlatformDocument["sections"][number]["items"]
): string {
  if (!items || items.length === 0) return "";

  const rows = items
    .map((item) => {
      const qty = typeof item.quantity === "number" ? formatNumberSv(item.quantity) : "–";
      const price = typeof item.unitPrice === "number" ? formatCurrencySv(item.unitPrice) : "–";
      const total = typeof item.total === "number" ? formatCurrencySv(item.total) : "–";
      const ref = item.description?.trim() ? item.description.trim() : "–";
      const note = item.value?.trim() ? item.value.trim() : "–";
      return `<tr>
<td>${escapeHtml(item.label)}</td>
<td>${escapeHtml(ref)}</td>
<td class="num">${escapeHtml(qty)}</td>
<td class="num">${escapeHtml(price)}</td>
<td class="num">${escapeHtml(total)}</td>
<td>${escapeHtml(note)}</td>
</tr>`;
    })
    .join("");

  return `<div class="doc-table-wrap">
<table class="doc-table">
<thead>
<tr>
<th>Moment/Åtgärd</th>
<th>Källa/Ref</th>
<th class="num">Antal</th>
<th class="num">A-pris</th>
<th class="num">Summa</th>
<th>Notering</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
</div>`;
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

  const projectTitle = request?.title || document.title;
  const projectLocation = request?.location || "Ej angiven";
  const projectContact = request?.propertySnapshot?.contactName || "Ej angiven";
  const budget = request?.budgetRange || "Ej angiven";
  const start = request?.desiredStart || "Ej angiven";
  const entrepreneurOrgNumber = extractEntrepreneurOrgNumber(document);
  const resolvedAttachments =
    document.attachments.length > 0
      ? document.attachments
      : document.linkedFileIds.map((fileId) => ({
          fileId,
          fileRefId: "",
          filename: fileMap.get(fileId) ?? fileId,
          folder: "ovrigt" as const,
          mimeType: "application/octet-stream",
        }));

  const sectionHtml = enabledSections
    .map((section) => {
      const fieldsHtml = section.fields
        .map(
          (field) => {
            const value = formatFieldValue(field);
            return `<div class="doc-row"><div class="doc-label">${escapeHtml(field.label)}</div><div class="doc-value">${escapeHtml(
              value
            )}</div></div>`;
          }
        )
        .join("");

      const itemsHtml = renderItemsTable(section.items);

      const attachmentsHtml =
        section.title.toLowerCase().includes("bilag")
          ? resolvedAttachments.length > 0
            ? `<ul class="doc-attachments">${resolvedAttachments
                .map(
                  (attachment) =>
                    `<li><span>${escapeHtml(attachment.filename)}</span><span class=\"doc-attachment-ref\">${escapeHtml(
                      attachment.fileRefId || "Saknar RefID"
                    )}</span></li>`
                )
                .join("")}</ul>`
            : `<p class="doc-empty">Inga bilagor valda.</p>`
          : "";

      return `
<section class="doc-section">
  <h2><span>${escapeHtml(section.title)}</span></h2>
  ${section.description ? `<p class="doc-description">${escapeHtml(section.description)}</p>` : ""}
  ${fieldsHtml.length > 0 ? `<div class="doc-grid">${fieldsHtml}</div>` : ""}
  ${itemsHtml}
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
    body { font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif; margin: 0; background: linear-gradient(180deg, #f6f4f1 0%, #efe9e1 100%); color: #2a2520; }
    .doc-wrap { max-width: 920px; margin: 26px auto; background: #fff; border: 1px solid #e6dfd6; border-radius: 18px; padding: 28px; box-shadow: 0 16px 38px rgba(42, 37, 32, 0.08); }
    .doc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding-bottom: 18px; border-bottom: 2px solid #efe8dd; }
    .doc-brand { font-size: 12px; font-weight: 700; letter-spacing: .11em; color: #8c7860; text-transform: uppercase; }
    .doc-title { margin: 8px 0 0; font-size: 28px; line-height: 1.15; letter-spacing: -0.02em; }
    .doc-badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .doc-badge { border: 1px solid #d9c9b7; background: #f8f2ea; color: #6b5a47; border-radius: 999px; padding: 6px 11px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .doc-overview { margin-top: 16px; display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
    .doc-card { border: 1px solid #e8e3dc; border-radius: 12px; padding: 12px; background: #fcfbf8; }
    .doc-meta-grid { margin-top: 8px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .doc-meta-key { font-size: 11px; color: #7b6d5e; text-transform: uppercase; letter-spacing: .05em; }
    .doc-meta-value { margin-top: 3px; font-size: 14px; font-weight: 600; color: #2a2520; word-break: break-word; }
    .doc-summary-title { margin: 0; font-size: 11px; color: #7b6d5e; text-transform: uppercase; letter-spacing: .06em; }
    .doc-summary-value { margin: 5px 0 0; font-size: 22px; font-weight: 700; color: #2a2520; }
    .doc-summary-sub { margin: 3px 0 0; font-size: 12px; color: #766b60; }
    .doc-section { margin-top: 20px; border-top: 1px solid #eee7dc; padding-top: 14px; break-inside: avoid; page-break-inside: avoid; }
    .doc-section h2 { margin: 0; font-size: 17px; }
    .doc-section h2 span { display: inline-block; border-bottom: 2px solid #d8c3ac; padding-bottom: 2px; }
    .doc-description { margin: 8px 0 0; color: #6b5a47; font-size: 13px; }
    .doc-grid { margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 8px; }
    .doc-row { border: 1px solid #eee7dc; border-radius: 10px; padding: 9px 10px; background: #fff; }
    .doc-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b5a47; font-weight: 700; }
    .doc-value { margin-top: 4px; font-size: 14px; white-space: pre-wrap; line-height: 1.42; }
    .doc-table-wrap { margin-top: 10px; border: 1px solid #eee7dc; border-radius: 12px; overflow: hidden; }
    .doc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .doc-table th { background: #f4ede4; color: #6b5a47; text-transform: uppercase; letter-spacing: .04em; font-size: 10px; padding: 8px 7px; text-align: left; }
    .doc-table td { padding: 8px 7px; border-top: 1px solid #f0e9de; vertical-align: top; }
    .doc-table tbody tr:nth-child(even) td { background: #fcfaf7; }
    .doc-table .num { text-align: right; white-space: nowrap; }
    .doc-attachments { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .doc-attachments li { border: 1px solid #e8e3dc; border-radius: 10px; background: #fff; padding: 7px 10px; font-size: 13px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .doc-attachment-ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #6b5a47; }
    .doc-empty { margin: 10px 0 0; color: #766b60; font-size: 13px; font-style: italic; }
    .doc-legal { margin-top: 18px; border-top: 1px dashed #e4dacd; padding-top: 8px; font-size: 11px; color: #7b6d5e; }
    @media print {
      body { background: #fff; }
      .doc-wrap { margin: 0; border: 0; border-radius: 0; max-width: none; padding: 0; box-shadow: none; }
      .doc-section, .doc-card, .doc-table-wrap { break-inside: avoid; page-break-inside: avoid; }
      .doc-overview { grid-template-columns: 1fr 1fr; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <article class="doc-wrap">
    <header class="doc-header">
      <div>
        <div class="doc-brand">Byggplattformen</div>
        <h1 class="doc-title">${escapeHtml(document.title)}</h1>
      </div>
      <div class="doc-badges">
        <span class="doc-badge">${escapeHtml(formatTypeLabel(document.type))}</span>
        <span class="doc-badge">${escapeHtml(formatStatusLabel(document.status))}</span>
        <span class="doc-badge">v${escapeHtml(document.version)}</span>
      </div>
    </header>
    <section class="doc-overview">
      <article class="doc-card">
        <div class="doc-meta-grid">
          <div><div class="doc-meta-key">Projekt</div><div class="doc-meta-value">${escapeHtml(projectTitle)}</div></div>
          <div><div class="doc-meta-key">Plats</div><div class="doc-meta-value">${escapeHtml(projectLocation)}</div></div>
          <div><div class="doc-meta-key">Kontakt</div><div class="doc-meta-value">${escapeHtml(projectContact)}</div></div>
          <div><div class="doc-meta-key">Request-ID</div><div class="doc-meta-value">${escapeHtml(document.requestId)}</div></div>
          <div><div class="doc-meta-key">Dokument-ID</div><div class="doc-meta-value">${escapeHtml(document.id)}</div></div>
          <div><div class="doc-meta-key">RefID</div><div class="doc-meta-value">${escapeHtml(document.refId)}</div></div>
          <div><div class="doc-meta-key">Uppdaterad</div><div class="doc-meta-value">${escapeHtml(new Date(document.updatedAt).toLocaleString("sv-SE"))}</div></div>
        </div>
      </article>
      <article class="doc-card">
        <p class="doc-summary-title">Budget och tid</p>
        <p class="doc-summary-value">${escapeHtml(budget)}</p>
        <p class="doc-summary-sub">Önskad start: ${escapeHtml(start)}</p>
      </article>
    </section>
    ${sectionHtml}
    <footer class="doc-legal">
      ${escapeHtml(document.requestId)} · Dokument-ID ${escapeHtml(document.id)} · RefID ${escapeHtml(document.refId)} · Org.nr entreprenad ${escapeHtml(entrepreneurOrgNumber)}
    </footer>
  </article>
</body>
</html>`;
}
