# Event Starter-List PDF — Design

**Date:** 2026-05-24
**Status:** Approved

## Goal

Add a printable starter list (Starterliste) PDF for EVENT competitions, mirroring the existing club-wide Bürodienst list (`/api/participants/pdf`) but scoped to the participants enrolled in a single event.

## Scope

- **Applies to:** EVENT competitions only (LEAGUE and SEASON not included)
- **Out of scope:** Changes to the existing `/api/participants/pdf` or `ParticipantListPdf` component, schema changes, audit logging (read-only feature)

## User Story

As an ADMIN or MANAGER preparing a Kranzl/Pokal/Spassschiessen, I want to print a starter list that contains only the participants enrolled in this event with their chosen discipline pre-filled, so that the table at the range has a focused, event-specific sheet for marking Einlage, Teilnahme and Geschossen.

## Visual Reference

Layout extends the existing `ParticipantListPdf` with a leading **Nr.** column for the (randomized) start order:

| Nr.                                                       | Name            | Disziplin   | Einlage | Teilnahme | Geschossen |
| --------------------------------------------------------- | --------------- | ----------- | ------- | --------- | ---------- |
| 3                                                         | Lastname, First | Luftpistole |         | ☐         | ☐          |
| 1                                                         | …               | …           |         | ☐         | ☐          |
| _10 empty rows for spontaneous starters — Nr. cell blank_ |

**Differences from the club-wide list:**

- Leading **Nr.** column (~30pt wide) carrying the start number 1..n distributed randomly across the n active participants
- Disziplin column is filled per row (per-participant for mixed events; competition discipline for fixed events)
- Empty Spontanstarter rows keep the Nr. cell blank

## Components

### 1. PDF component — `src/lib/pdf/EventStarterListPdf.tsx`

- Reuses the layout primitives, column widths and `styles` from `ParticipantListPdf` — extract shared helpers if duplication would otherwise occur, but do not refactor the existing component's behavior.
- Header:
  - Title: `Starterliste`
  - Subtitle: `<competition.name> · <eventDate formatted dd.mm.yyyy>` — date only rendered if `competition.eventDate` is set.
- Body:
  - One row per ACTIVE participant (input is already filtered and pre-shuffled by the caller; the component renders rows in the order given and displays the `startNumber` field as-is)
  - Nr. column shows `startNumber` (the random 1..n value assigned in the route)
  - Disziplin column carries the discipline name passed in per row
  - 10 empty rows for Spontanstarter — Nr. and Disziplin cells blank
- Column widths (rebalanced to fit A4 with the new Nr. column; total budget stays the same as `ParticipantListPdf`):
  - `nr: 30`, `name: 185`, `disziplin: 110`, `einlage: 60`, `teilnahme: 65`, `geschossen: 65`
  - Header alignment: Nr. centered, Name/Disziplin left-aligned, the rest centered (matches existing convention)
- Footer: `Starterliste — <competition.name>` left, page number right.

**Props:**

```ts
interface EventStarterListPdfProps {
  competitionName: string
  eventDate: Date | null
  participants: {
    startNumber: number
    firstName: string
    lastName: string
    disciplineName: string | null
  }[]
  generatedAt: Date
}
```

### 2. API route — `src/app/api/competitions/[id]/starter-list/pdf/route.ts`

- Auth: 401 if not signed in, 403 if not `canManage`
- Load `getCompetitionById(id)`:
  - 404 if not found
  - 400 if `competition.type !== "EVENT"`
- Load `getCompetitionParticipants(id)`, filter to `status === "ACTIVE"`
- Assign random start numbers:
  - Build numbers `[1..n]` where n = number of ACTIVE participants
  - Fisher–Yates shuffle using `crypto.randomInt` (Node built-in) for unbiased randomness
  - Reorder participants so the array index 0..n-1 carries the corresponding `startNumber`
  - A fresh shuffle on every request — order is not persisted
- For each participant: `disciplineName = cp.discipline?.name ?? competition.discipline?.name ?? null`
  - For fixed-discipline events: every row gets the competition's discipline
  - For mixed events: every active enrollment must have a discipline (UI invariant); the fallback handles defensive nulls
- Render via `renderToBuffer(createElement(EventStarterListPdf, {...}))`
- Response:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="starterliste-<slug>.pdf"` where `<slug>` is a kebab-case lowercased slug of the competition name (ascii-only; non-letter/digit → `-`; collapse repeats)
  - `Cache-Control: no-store`

### 3. UI integration — `src/app/(app)/competitions/[id]/participants/page.tsx`

- Add `<PdfDownloadButton href={`/api/competitions/${id}/starter-list/pdf`} label="Starterliste drucken" />` to the page header.
- Render only when `competition.type === "EVENT"`.
- Visible to ADMIN and MANAGER (the page itself already requires `canManage`, so no extra gating needed).

## Data Flow

```
Participants page (server component)
  └─> Renders PdfDownloadButton (client) with href to API route
       └─> User clicks → GET /api/competitions/[id]/starter-list/pdf
            └─> Route: auth → type guard → load participants → render PDF → respond
```

## Edge Cases

| Case                                  | Behavior                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------- |
| No ACTIVE participants                | PDF generated with 0 data rows + 10 empty rows (usable as blank list)       |
| WITHDRAWN participants                | Excluded                                                                    |
| Pre-registered guest (isGuest: true)  | Included if ACTIVE (treated like any other participant on the list)         |
| LEAGUE / SEASON competition           | API returns 400; button is not rendered on the page                         |
| Mixed event, participant without disc | Defensive: cell rendered blank (UI prevents this via enrollment validation) |
| Competition not found                 | API returns 404                                                             |
| Unauthenticated / not canManage       | API returns 401 / 403                                                       |

## Tests

### `EventStarterListPdf.test.tsx`

- Renders without crashing for empty participants array
- Renders 10 empty rows regardless of participant count
- Renders participant rows with their disciplineName and startNumber
- Header subtitle includes formatted eventDate when present, omits date segment when null

### Route test `route.test.ts`

- 401 without session
- 403 for USER role
- 404 for unknown competition id
- 400 for LEAGUE competition
- 400 for SEASON competition
- 200 with `application/pdf` content type and `Content-Disposition: attachment` for a valid EVENT competition
- Excludes WITHDRAWN participants from the rendered data passed to the PDF component (mocked component to assert props)
- Assigns each ACTIVE participant a unique `startNumber` in `[1..n]` (mock PDF component → assert: set of numbers equals `{1..n}`, no duplicates)
- With `crypto.randomInt` mocked to a deterministic value, the resulting order matches the expected Fisher–Yates output (proves the shuffle is wired, not a no-op)

### UI page test (if existing pattern covers it)

- Button rendered for EVENT competition
- Button NOT rendered for LEAGUE/SEASON competition

## Implementation Order (Layer Order)

The change does not touch schema or domain logic. Effective order:

1. PDF component (`EventStarterListPdf.tsx`) + tests
2. API route + tests
3. UI integration in participants page
4. Update docs (`features.md`) — add bullet under Event-Modus → Teilnehmer & Gäste describing the new export

## What Does Not Change

- Existing `/api/participants/pdf` and `ParticipantListPdf`
- Database schema, queries `getCompetitionParticipants` / `getCompetitionById`
- Audit log behavior (read-only feature, no logging)
