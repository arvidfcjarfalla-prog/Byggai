import type { PlatformDocument } from "../documents-store";
import type { PlatformRequest } from "../requests-store";
import { buildDocumentPdfFilename, renderDocumentToPdfBytes } from "./render-document";

export async function generateDocumentPdf(input: {
  document: PlatformDocument;
  request: PlatformRequest | null;
  generatedAtIso?: string;
}): Promise<{ bytes: Uint8Array; fileName: string }> {
  const bytes = await renderDocumentToPdfBytes({
    document: input.document,
    request: input.request,
    generatedAtIso: input.generatedAtIso ?? input.document.updatedAt,
  });

  return {
    bytes,
    fileName: buildDocumentPdfFilename(input.document, input.request),
  };
}
