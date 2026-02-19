import type { PlatformRequest } from "./requests-store";
import type { DocumentSection, DocumentType } from "./documents-store";

function defaultSection(title: string): DocumentSection {
  return {
    id: `ai-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title,
    enabled: true,
    fields: [
      {
        id: "ai-note",
        label: "AI-förslag",
        type: "textarea",
        value: "AI-förslag kommer i en senare version.",
      },
    ],
  };
}

export function suggestDocumentSections(
  request: PlatformRequest,
  type: DocumentType
): DocumentSection[] {
  const scopeHints =
    request.scope.scopeItems?.slice(0, 2).map((item) => item.title) ??
    request.scope.actions?.slice(0, 2).map((action) => action.title) ??
    [];

  if (type === "quote") {
    return [
      defaultSection("AI: Scope-sammanfattning"),
      {
        id: "ai-scope",
        title: "AI: Prioriterade moment",
        enabled: true,
        fields: [
          {
            id: "priorities",
            label: "Prioriteringar",
            type: "textarea",
            value:
              scopeHints.length > 0
                ? `Prioritera inledningsvis: ${scopeHints.join(", ")}.`
                : "AI-förslag kommer i en senare version.",
          },
        ],
      },
    ];
  }

  return [defaultSection(`AI: ${type.toUpperCase()}-forslag`)];
}

export function suggestReservations(request: PlatformRequest): string[] {
  const reservations = [
    "Förutsatter platsbesök före slutlig kalkyl.",
    "Dolda fel och avvikelser kan medföra justering av pris och tidplan.",
    "Ändringar hanteras som ÄTA efter skriftligt godkännande.",
  ];

  if (request.audience === "brf") {
    reservations.push("Styrelsebeslut kan krävas före byggstart.");
  }

  return reservations;
}

export function summarizeScopeToOfferText(request: PlatformRequest): string {
  const scope = request.scope.scopeItems?.map((item) => item.title) ?? [];
  const actions = request.scope.actions?.map((action) => action.title) ?? [];
  const combined = [...scope, ...actions].slice(0, 6);

  if (combined.length === 0) {
    return "Omfattning fastställs efter platsbesök och teknisk genomgång.";
  }

  return `Projektet omfattar i huvudsak: ${combined.join(", ")}. Slutlig omfattning verifieras vid platsbesök.`;
}
