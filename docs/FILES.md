# Filer-system

## Översikt
`Filer` är ett projektbundet virtuellt filsystem med mappar:
- `avtal`
- `offert`
- `ata`
- `bilder`
- `ritningar`
- `ovrigt`

Varje fil sparar metadata inklusive:
- `id`, `refId`, `projectId`, `folder`, `filename`, `mimeType`, `size`, `createdAt`, `createdBy`
- `sourceType`, `sourceId` (baklänk till dokument)
- provenance: `senderRole`, `senderWorkspaceId`, `recipientWorkspaceId`, `deliveredAt`, `version`

Vid första access till ett projekt körs folder-migration/initialisering via `ensureProjectFileTree(projectId)` som skapar standardmapparna.

## Lagring
- Metadata: `localStorage` (`byggplattformen-project-files-v1`)
- Innehåll: IndexedDB först, localStorage-fallback för små filer
- Backend source of truth för filmetadata + audit/notiser: `data/backend-store.json` via API:
  - `GET /api/files?projectId=...` (fil-lista)
  - `POST /api/files` (upsert av en eller flera filer)
  - `DELETE /api/files/:fileId` (ta bort fil + audit + ev. notis till BRF/Privat)
  - `PATCH /api/files/:fileId` (metadataändring + audit)
  - `GET /api/notifications` och `PATCH /api/notifications/:notificationId/read`
- Frontend använder backend-listan och synkar cache lokalt (bootstrap migrerar befintlig lokal metadata till backend per projekt).

### Storleksgräns
Fallback till localStorage används bara för små filer (max `2_500_000` bytes) för att undvika kvotproblem.

## PDF-flöde
- Vid skapande/sparande av Offert/Avtal/ÄTA genereras PDF med `renderDocumentToPdfBytes`.
- PDF lagras i korrekt mapp baserat på dokumenttyp.
- Filen länkas tillbaka till dokument via `sourceId=document.id`.

## Delning
- `Skicka PDF` kopierar PDF-filen till mottagarens workspace (BRF/Privat).
- Delning sker med copy-semantik (immutabel kopia): originalfilen ändras inte.
- Delad fil behåller källmetadata och avsändarspårning.

## Öppna filer
`FilesBrowser` läser innehåll från lagringsbackend, skapar `Blob` + `URL.createObjectURL`, och öppnar PDF i ny flik.
