# Projekt-tidslinje

## Syfte
`Projekt-tidslinje` visar samma canonical projektflöde för alla roller (Entreprenör, BRF, Privatperson) men med olika rekommenderade handlingar (CTA).

Tidslinjen byggs av `app/lib/timeline/builder.ts` och renderas i `app/components/timeline/project-timeline.tsx`.

## Canonical milstolpar
Milstolpar beräknas i denna ordning:

1. Projekt skapat
2. Anbudsförfrågan skapad
3. Anbudsförfrågan skickad
4. Frågor/svar (valfritt)
5. Offert mottagen / skickad
6. Offert accepterad / avvisad
7. Avtal skapat
8. Avtal signerat / bekräftat
9. Planering (startdatum satt)
10. Pågående arbete
11. ÄTA skapad / godkänd (valfritt, kan ske flera gånger)
12. Slutfört / avslutat

Milstolpsstatus visas som:
- `done`
- `current`
- `todo`

Valfria steg (`Frågor/svar`, `ÄTA`) blockerar inte progression om senare steg har uppnåtts.

## Event mapping
Eventströmmen byggs helt från befintliga stores:

- `requests-store`
  - förfrågan skapad/skickad
  - mottagare skickad till
- `documents-store`
  - dokument skapat/skickat/godkänt/avvisat
  - typer: offert, avtal, ÄTA
- `project-files/store`
  - bilagor och genererade PDF-filer
- `request-messages`
  - meddelandehändelser

Event innehåller:
- tidsstämpel (ISO -> `sv-SE` i UI)
- händelselabel
- ev. RefID
- länk till underliggande entitet
- filtertaggar (`dokument`, `filer`, `ata`, `meddelanden`)

## Projektkoppling (ID)
Projektomfång styrs av `request.id`.

Samma ID återanvänds i:
- dokument (`requestId`)
- filer (`projectId`)
- meddelanden (`requestId`)

## Migration för dokumentstatus-tider
`documents-store` har kompletterats med optionella fält:
- `sentAt`
- `acceptedAt`
- `rejectedAt`

Vid normalisering migreras äldre poster säkert:
- saknas tider infereras minimalt från `updatedAt`/`createdAt` beroende på status
- inga krascher vid saknade/ogiltiga tidsfält

## Utökning
För att lägga till nya steg:

1. Uppdatera milestone-seeds i `buildProjectTimeline`.
2. Mappa nya händelser till eventlistan och tilldela filtertaggar.
3. Lägg till/justera CTA per roll i `roleActions`.
4. Vid behov, utöka store-modeller med nya tidsfält och normalisering (bakåtkompatibelt).
