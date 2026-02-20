# RefID i Byggplattformen

## Varför RefID
RefID ger ett stabilt, mänskligt läsbart referensnummer för dokument och filer.
Det gör att användare kan hänvisa till bilagor och handlingar utan att använda interna tekniska id:n.

## Format
RefID är syntetiskt (inte personnummer-liknande).

- Dokument: `DOC-<YY><BASE32>-<C>`
- Filer: `FIL-<YY><BASE32>-<C>`

Där:
- `<YY>` = tvåsiffrigt år.
- `<BASE32>` = Crockford Base32 (utan tvetydiga tecken).
- `<C>` = checksum-tecken för att fånga skrivfel.

Exempel:
- `DOC-26AB7K3Q9P-W`
- `FIL-26D91X2R4M-3`

## Regler
- Inmatning normaliseras (upper/lower, mellanslag och extra bindestreck tolereras).
- RefID valideras med checksum.
- Kollisionskontroll görs via registry i localStorage.
- Saknade RefID på äldre poster backfylls vid första läsning (idempotent migration).

## Var RefID visas
- Dokumentlistor och dokumentviewer.
- Filer-listor i projektets Filer.
- PDF-header/meta för dokument.
- Bilagor i dokument/PDF (filnamn + FIL-RefID).

## Bilagor och referenser
När nytt dokument skapas kan användaren välja bilagor från projektets Filer.
Valda bilagor lagras strukturerat i dokumentet:

- `fileId`
- `fileRefId`
- `filename`
- `folder`
- `mimeType`

Det gör att bilagor kan refereras exakt i dokumenttext och PDF.

## Lagring
- Registry-key: `byggplattformen-refid-registry-v1`
- Dokument lagrar `refId` (DOC).
- Projektfiler lagrar `refId` (FIL).
