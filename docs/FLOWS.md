# Click-Flow Audit and IA Refactor

## Scope
Audit of routing, sidebar navigation, and major CTA flows under `app/` for roles:
- Privatperson
- BRF
- Entreprenör

## Current State Audit (Before Refactor)

### Entry points
- Role landings:
  - `app/privatperson/page.tsx`
  - `app/brf/page.tsx`
  - `app/entreprenor/page.tsx`
- Auth entry:
  - `app/login/page.tsx`
  - `app/konto/page.tsx`
- Dashboard router:
  - `app/dashboard/page.tsx`

### Main role areas (before)
- Privat:
  - `app/dashboard/privat/page.tsx`
  - `app/dashboard/privat/underlag/page.tsx`
  - `app/dashboard/privat/forfragningar/page.tsx`
  - `app/dashboard/privat/dokumentinkorg/page.tsx`
  - `app/dashboard/privat/filer/page.tsx`
  - `app/dashboard/privat/dokument/[documentId]/page.tsx`
- BRF:
  - `app/dashboard/brf/page.tsx`
  - `app/dashboard/brf/fastighet/page.tsx`
  - `app/dashboard/brf/underhallsplan/page.tsx`
  - `app/dashboard/brf/forfragningar/page.tsx`
  - `app/dashboard/brf/dokumentinkorg/page.tsx`
  - `app/dashboard/brf/filer/page.tsx`
  - `app/dashboard/brf/dokument/[documentId]/page.tsx`
- Entreprenör:
  - `app/dashboard/entreprenor/page.tsx`
  - `app/dashboard/entreprenor/forfragningar/page.tsx`
  - `app/dashboard/entreprenor/meddelanden/page.tsx`
  - `app/dashboard/entreprenor/dokument/page.tsx`
  - `app/dashboard/entreprenor/dokument/[documentId]/page.tsx`
  - `app/dashboard/entreprenor/filer/page.tsx`

### Problems found
1. No single source of truth for navigation.
- `DashboardShell` received local `navItems` from many pages.
- Labels/order drifted between pages and roles.

2. Illogical hierarchy.
- Sidebar auto-injected `Filer` as nested child under document routes.
- This created confusing IA where file library looked subordinate to document creation.

3. Inconsistent route naming for same concept.
- BRF/Privat used `.../dokumentinkorg` while Entreprenör used `.../dokument`.
- Timeline existed both as global `/timeline` and role routes.
- Mixed labels: `Timeline`, `Tidslinje`, `Dokumentgenerator`, `Avtalsinkorg`.

4. Unclear click flows and where-to-go-next.
- Several pages had valid links but inconsistent destination semantics.
- Same concept sometimes accessible through multiple labels/routes.

5. Limited “where am I” context.
- Active state came from local page nav arrays and was not globally reliable.

## Refactor Goals
- Centralize sidebar IA in one module.
- Normalize canonical route slugs across roles.
- Keep backwards compatibility with redirects for renamed routes.
- Make main journey predictable: list -> detail -> back to canonical list.

## Target Canonical Route Map

### Shared conventions
- `.../tidslinje`
- `.../planering`
- `.../forfragningar`
- `.../dokument`
- `.../filer`
- `.../meddelanden`
- `.../konto` (shared under `/dashboard/konto`)

### Privat
- Översikt: `/dashboard/privat`
- Projekt: `/dashboard/privat/underlag`, `/dashboard/privat/tidslinje`, `/dashboard/privat/planering`
- Förfrågningar: `/dashboard/privat/forfragningar`
- Dokument: `/dashboard/privat/dokument`
- Filer: `/dashboard/privat/filer`
- Meddelanden: `/dashboard/privat/meddelanden`
- Konto: `/dashboard/konto`

### BRF
- Översikt: `/dashboard/brf`
- Projekt: `/dashboard/brf/fastighet`, `/dashboard/brf/underhallsplan`, `/dashboard/brf/tidslinje`, `/dashboard/brf/planering`
- Förfrågningar: `/dashboard/brf/forfragningar`
- Dokument: `/dashboard/brf/dokument`
- Filer: `/dashboard/brf/filer`
- Meddelanden: `/dashboard/brf/meddelanden`
- Konto: `/dashboard/konto`

### Entreprenör
- Översikt: `/dashboard/entreprenor`
- Projekt: `/dashboard/entreprenor/tidslinje`
- Förfrågningar: `/dashboard/entreprenor/forfragningar`
- Dokument: `/dashboard/entreprenor/dokument`
- Filer: `/dashboard/entreprenor/filer`
- Meddelanden: `/dashboard/entreprenor/meddelanden`
- Konto: `/dashboard/konto`

## Primary Journeys (Current Implementation)

### Privat/BRF: create project -> request -> send -> offers -> accept -> contract -> files/ÄTA -> close
1. Create project input
- Privat: wizard under `app/start/*` ending at `app/start/sammanfattning/page.tsx`
- BRF: flow under `app/brf/start/*` ending at `app/brf/start/sammanfattning/page.tsx`

2. Create/send request
- Persisted via `app/lib/requests-store.ts`
- Follow-up list/context in `app/dashboard/{privat|brf}/forfragningar/page.tsx`
- UI component: `app/components/requests-outbox-panel.tsx`

3. Receive offers/contracts/ÄTA
- Canonical inbox: `app/dashboard/{privat|brf}/dokument/page.tsx`
- UI component: `app/components/documents-inbox-panel.tsx`
- Detail: `app/dashboard/{privat|brf}/dokument/[documentId]/page.tsx`

4. Files and ÄTA artifacts
- `app/dashboard/{privat|brf}/filer/page.tsx`
- UI component: `app/components/files/files-browser.tsx`

5. Messages
- `app/dashboard/{privat|brf}/meddelanden/page.tsx`
- UI component: `app/components/requests-outbox-panel.tsx` in `messages` mode

6. Status and planning
- `app/dashboard/{privat|brf}/tidslinje/page.tsx`
- UI component: `app/components/timeline/project-timeline.tsx`
- Builder: `app/lib/timeline/builder.ts`
- `app/dashboard/{privat|brf}/planering/page.tsx` (Gantt)
- UI component: `app/timeline/page.tsx`

### Entreprenör: receive leads -> create offer -> send -> contract -> files/ÄTA -> close
1. Receive leads/requests
- `app/dashboard/entreprenor/forfragningar/page.tsx`

2. Create and manage offer/contract/ÄTA docs
- List/create: `app/dashboard/entreprenor/dokument/page.tsx`
- Detail/editor: `app/dashboard/entreprenor/dokument/[documentId]/page.tsx`
- Generation panel: `app/components/request-document-generator-panel.tsx`

3. Send and communicate
- Messages: `app/dashboard/entreprenor/meddelanden/page.tsx`
- Document send/share in editor via `app/lib/project-files/document-integration.ts`

4. Files and timeline
- Files: `app/dashboard/entreprenor/filer/page.tsx`
- Timeline: `app/dashboard/entreprenor/tidslinje/page.tsx`

## Compatibility Redirects
- Legacy routes preserved:
  - `/dashboard/brf/dokumentinkorg` -> `/dashboard/brf/dokument`
  - `/dashboard/privat/dokumentinkorg` -> `/dashboard/privat/dokument`

## Single Source of Truth
- Sidebar config now centralized in:
  - `app/lib/navigation.ts`
- API:
  - `getSidebarNav(role): NavGroup[]`
  - `getQuickActions(role): QuickAction[]`

## Notes on `/timeline`
- Canonical status routes are role-scoped under `/dashboard/*/tidslinje`.
- Canonical Gantt-planning routes are role-scoped under `/dashboard/*/planering`.
- Legacy `/timeline` is kept for backward compatibility and forwards BRF/Privat users to role-scoped `/dashboard/*/planering`.
