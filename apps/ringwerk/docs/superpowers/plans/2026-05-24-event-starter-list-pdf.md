# Event Starter-List PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a printable starter list PDF for EVENT competitions, scoped to enrolled ACTIVE participants, with a leading "Nr." column carrying a randomly shuffled 1..n start order and a discipline column filled per row.

**Architecture:** Mirrors the existing `/api/participants/pdf` → `ParticipantListPdf` pipeline. A pure helper builds the PDF props (filters, maps, shuffles); the PDF component renders the document; the route wires auth, the EVENT-type guard, and PDF buffer generation. UI gets a `PdfDownloadButton` on the event participants page.

**Tech Stack:** Next.js 16 App Router, React 19, `@react-pdf/renderer`, Vitest, Prisma 7. Node's `crypto.randomInt` for unbiased shuffling.

---

## Required Docs

Baseline subagent reading per `.claude/CLAUDE.md` (`code-conventions.md`, `reference-files.md`, `data-model.md`, `architecture.md`, `features.md`, `ui-patterns.md`). No additional task-specific docs needed.

## Spec Reference

`.claude/docs/superpowers/specs/2026-05-24-event-starter-list-pdf-design.md`

## File Structure

**Create:**

- `src/lib/pdf/eventStarterList.ts` — pure helper that filters ACTIVE participants, resolves disciplineName, and assigns a shuffled `nr` (uses injectable RNG for testability)
- `src/lib/pdf/eventStarterList.test.ts` — unit tests for the helper
- `src/lib/pdf/EventStarterListPdf.tsx` — `@react-pdf/renderer` component
- `src/lib/pdf/EventStarterListPdf.test.tsx` — smoke render tests
- `src/app/api/competitions/[id]/starter-list/pdf/route.ts` — GET handler

**Modify:**

- `src/app/(app)/competitions/[id]/participants/page.tsx` — add `PdfDownloadButton` for EVENT competitions
- `.claude/docs/features.md` — add bullet under "Event-Modus" describing the new export

---

## Task 1: Pure helper for building starter-list rows

**Files:**

- Create: `src/lib/pdf/eventStarterList.ts`
- Test: `src/lib/pdf/eventStarterList.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pdf/eventStarterList.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildStarterListRows } from "@/lib/pdf/eventStarterList"

type CP = Parameters<typeof buildStarterListRows>[0]["participants"][number]

function makeCp(opts: Partial<CP> & { lastName: string; firstName: string }): CP {
  return {
    status: "ACTIVE",
    participant: { firstName: opts.firstName, lastName: opts.lastName },
    discipline: opts.discipline ?? null,
    ...opts,
  } as CP
}

describe("buildStarterListRows", () => {
  it("excludes WITHDRAWN participants", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "Active" }),
        makeCp({ firstName: "W", lastName: "Withdrawn", status: "WITHDRAWN" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].lastName).toBe("Active")
  })

  it("assigns unique start numbers 1..n", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "One" }),
        makeCp({ firstName: "B", lastName: "Two" }),
        makeCp({ firstName: "C", lastName: "Three" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    const nrs = rows.map((r) => r.nr).sort((a, b) => a - b)
    expect(nrs).toEqual([1, 2, 3])
  })

  it("with deterministic random=()=>0 produces reversed order (Fisher–Yates property)", () => {
    // Fisher–Yates with random()=0 always picks index 0 → reverses the original input
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "One" }),
        makeCp({ firstName: "B", lastName: "Two" }),
        makeCp({ firstName: "C", lastName: "Three" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows.map((r) => r.lastName)).toEqual(["Three", "Two", "One"])
  })

  it("uses participant discipline when set (mixed event)", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({
          firstName: "A",
          lastName: "Mix",
          discipline: { name: "Luftgewehr" },
        }),
      ],
      competitionDisciplineName: null,
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBe("Luftgewehr")
  })

  it("falls back to competition discipline when participant has none (fixed event)", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "A", lastName: "Fix", discipline: null })],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBe("Luftpistole")
  })

  it("returns null disciplineName when neither participant nor competition has one", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "A", lastName: "None", discipline: null })],
      competitionDisciplineName: null,
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBeNull()
  })

  it("returns empty array when there are no ACTIVE participants", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "W", lastName: "Out", status: "WITHDRAWN" })],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/pdf/eventStarterList.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/lib/pdf/eventStarterList.ts`:

```ts
export interface StarterListInputParticipant {
  status: "ACTIVE" | "WITHDRAWN"
  participant: { firstName: string; lastName: string }
  discipline: { name: string } | null
}

export interface StarterListRow {
  nr: number
  firstName: string
  lastName: string
  disciplineName: string | null
}

interface BuildArgs {
  participants: StarterListInputParticipant[]
  competitionDisciplineName: string | null
  random: () => number
}

/**
 * Filters ACTIVE participants, resolves discipline (per-row → competition fallback),
 * and assigns a Fisher–Yates–shuffled start number 1..n.
 *
 * `random` injection makes the shuffle deterministic in tests.
 */
export function buildStarterListRows({
  participants,
  competitionDisciplineName,
  random,
}: BuildArgs): StarterListRow[] {
  const active = participants.filter((p) => p.status === "ACTIVE")
  const shuffled = [...active]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.map((cp, idx) => ({
    nr: idx + 1,
    firstName: cp.participant.firstName,
    lastName: cp.participant.lastName,
    disciplineName: cp.discipline?.name ?? competitionDisciplineName ?? null,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/pdf/eventStarterList.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/eventStarterList.ts src/lib/pdf/eventStarterList.test.ts
git commit -m "feat(pdf): add helper to build event starter-list rows"
```

---

## Task 2: PDF component `EventStarterListPdf`

**Files:**

- Create: `src/lib/pdf/EventStarterListPdf.tsx`
- Test: `src/lib/pdf/EventStarterListPdf.test.tsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/lib/pdf/EventStarterListPdf.test.tsx`:

```tsx
import { describe, expect, it } from "vitest"
import { renderToString } from "@react-pdf/renderer"
import { createElement } from "react"
import { EventStarterListPdf } from "@/lib/pdf/EventStarterListPdf"

describe("EventStarterListPdf", () => {
  const baseProps = {
    competitionName: "Kranzlschiessen 2026",
    eventDate: new Date("2026-06-15T08:00:00.000Z"),
    participants: [
      { nr: 1, firstName: "Anna", lastName: "Schütz", disciplineName: "Luftpistole" },
      { nr: 2, firstName: "Bert", lastName: "Müller", disciplineName: "Luftgewehr" },
    ],
    generatedAt: new Date("2026-05-24T10:00:00.000Z"),
  }

  it("renders with participants", async () => {
    const xml = await renderToString(createElement(EventStarterListPdf, baseProps))
    expect(xml).toContain("Starterliste")
    expect(xml).toContain("Kranzlschiessen 2026")
    expect(xml).toContain("Schütz, Anna")
    expect(xml).toContain("Müller, Bert")
    expect(xml).toContain("Luftpistole")
    expect(xml).toContain("Luftgewehr")
  })

  it("renders without participants (blank list)", async () => {
    const xml = await renderToString(
      createElement(EventStarterListPdf, { ...baseProps, participants: [] })
    )
    expect(xml).toContain("Starterliste")
    expect(xml).toContain("Kranzlschiessen 2026")
  })

  it("omits date segment from subtitle when eventDate is null", async () => {
    const xml = await renderToString(
      createElement(EventStarterListPdf, { ...baseProps, eventDate: null })
    )
    // Subtitle should still have competition name but no " · " separator-with-date.
    expect(xml).toContain("Kranzlschiessen 2026")
    expect(xml).not.toMatch(/Kranzlschiessen 2026 ·/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/pdf/EventStarterListPdf.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the PDF component**

Create `src/lib/pdf/EventStarterListPdf.tsx`:

```tsx
import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement, ReactNode } from "react"
import { styles } from "@/lib/pdf/styles"

const W = { nr: 30, name: 185, disziplin: 110, einlage: 60, teilnahme: 65, geschossen: 65 }
const ROW_H = 28
const EMPTY_ROWS = 10

function formatDateDe(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function Checkbox(): ReactElement {
  return <View style={styles.checkbox} />
}

function Cell({
  children,
  width,
  borderRight = false,
  paddingLeft = 0,
  align = "flex-start",
}: {
  children: ReactNode
  width: number
  borderRight?: boolean
  paddingLeft?: number
  align?: "flex-start" | "center"
}): ReactElement {
  return (
    <View
      style={{
        width,
        height: ROW_H,
        paddingLeft,
        justifyContent: "center",
        alignItems: align,
        borderRightWidth: borderRight ? 1 : 0,
        borderRightColor: "#dddddd",
        borderRightStyle: "solid",
      }}
    >
      {children}
    </View>
  )
}

interface PdfHeaderProps {
  competitionName: string
  eventDate: Date | null
  generatedAt: Date
}

function PdfHeader({ competitionName, eventDate, generatedAt }: PdfHeaderProps): ReactElement {
  const subtitle = eventDate ? `${competitionName} · ${formatDateDe(eventDate)}` : competitionName
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Starterliste</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDateDe(generatedAt)}</Text>
    </View>
  )
}

export interface EventStarterListPdfProps {
  competitionName: string
  eventDate: Date | null
  participants: {
    nr: number
    firstName: string
    lastName: string
    disciplineName: string | null
  }[]
  generatedAt: Date
}

export function EventStarterListPdf({
  competitionName,
  eventDate,
  participants,
  generatedAt,
}: EventStarterListPdfProps): ReactElement {
  return (
    <Document title="Starterliste" author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        <PdfHeader
          competitionName={competitionName}
          eventDate={eventDate}
          generatedAt={generatedAt}
        />

        <View style={styles.table}>
          {/* Kopfzeile */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: W.nr }]}>Nr.</Text>
            <Text style={[styles.tableHeaderCellLeft, { width: W.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCellLeft, { width: W.disziplin, paddingLeft: 5 }]}>
              Disziplin
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W.einlage }]}>Einlage</Text>
            <Text style={[styles.tableHeaderCell, { width: W.teilnahme }]}>Teilnahme</Text>
            <Text style={[styles.tableHeaderCell, { width: W.geschossen }]}>Geschossen</Text>
          </View>

          {/* Teilnehmer-Zeilen */}
          {participants.map((p, idx) => (
            <View
              key={`p-${p.nr}`}
              wrap={false}
              style={[
                {
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: "#eeeeee",
                  borderBottomStyle: "solid",
                },
                idx % 2 === 1 ? styles.tableRowAlt : {},
              ]}
            >
              <Cell width={W.nr} borderRight align="center">
                <Text style={styles.tableCellBold}>{p.nr}</Text>
              </Cell>
              <Cell width={W.name} borderRight paddingLeft={8}>
                <Text style={styles.tableCellLeft}>
                  {p.lastName}, {p.firstName}
                </Text>
              </Cell>
              <Cell width={W.disziplin} borderRight paddingLeft={5}>
                <Text style={styles.tableCellLeft}>{p.disciplineName ?? " "}</Text>
              </Cell>
              <Cell width={W.einlage} borderRight align="center">
                <Text style={styles.tableCell}> </Text>
              </Cell>
              <Cell width={W.teilnahme} align="center">
                <Checkbox />
              </Cell>
              <Cell width={W.geschossen} align="center">
                <Checkbox />
              </Cell>
            </View>
          ))}

          {/* Leerzeilen für Spontanstarter */}
          {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
            <View
              key={`empty-${i}`}
              wrap={false}
              style={{
                flexDirection: "row",
                borderBottomWidth: 1,
                borderBottomColor: "#eeeeee",
                borderBottomStyle: "solid",
                backgroundColor: "#fafafa",
              }}
            >
              <Cell width={W.nr} borderRight align="center">
                <Text style={styles.tableCell}> </Text>
              </Cell>
              <Cell width={W.name} borderRight paddingLeft={8}>
                <Text style={styles.tableCellLeft}> </Text>
              </Cell>
              <Cell width={W.disziplin} borderRight paddingLeft={5}>
                <Text style={styles.tableCellLeft}> </Text>
              </Cell>
              <Cell width={W.einlage} borderRight align="center">
                <Text style={styles.tableCell}> </Text>
              </Cell>
              <Cell width={W.teilnahme} align="center">
                <Checkbox />
              </Cell>
              <Cell width={W.geschossen} align="center">
                <Checkbox />
              </Cell>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Starterliste — {competitionName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/pdf/EventStarterListPdf.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/EventStarterListPdf.tsx src/lib/pdf/EventStarterListPdf.test.tsx
git commit -m "feat(pdf): add EventStarterListPdf component with Nr. column"
```

---

## Task 3: API route `/api/competitions/[id]/starter-list/pdf`

**Files:**

- Create: `src/app/api/competitions/[id]/starter-list/pdf/route.ts`

This route is pragmatically smoke-tested — the unit-testable pieces live in Task 1's helper. The route is thin glue: auth, type guard, helper invocation, PDF buffer generation. We verify it by manual run + the helper tests already in place.

- [ ] **Step 1: Implement the route**

Create `src/app/api/competitions/[id]/starter-list/pdf/route.ts`:

```ts
import { NextResponse } from "next/server"
import { randomInt } from "node:crypto"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getCompetitionParticipants } from "@/lib/competitionParticipants/queries"
import { buildStarterListRows } from "@/lib/pdf/eventStarterList"
import { EventStarterListPdf } from "@/lib/pdf/EventStarterListPdf"

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }
  if (!canManage(session.user.role)) {
    return new NextResponse("Keine Berechtigung", { status: 403 })
  }

  const { id } = await context.params
  const competition = await getCompetitionById(id)
  if (!competition) {
    return new NextResponse("Wettbewerb nicht gefunden", { status: 404 })
  }
  if (competition.type !== "EVENT") {
    return new NextResponse("Starterliste nur für Events verfügbar", { status: 400 })
  }

  const participants = await getCompetitionParticipants(id)

  const rows = buildStarterListRows({
    participants: participants.map((cp) => ({
      status: cp.status,
      participant: {
        firstName: cp.participant.firstName,
        lastName: cp.participant.lastName,
      },
      discipline: cp.discipline ? { name: cp.discipline.name } : null,
    })),
    competitionDisciplineName: competition.discipline?.name ?? null,
    // crypto.randomInt(n) returns 0..n-1; divide by n for Math.random()-compatible [0,1)
    random: () => randomInt(0, 1_000_000) / 1_000_000,
  })

  const element = createElement(EventStarterListPdf, {
    competitionName: competition.name,
    eventDate: competition.eventDate ?? null,
    participants: rows,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="starterliste-${slugify(competition.name)}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
```

- [ ] **Step 2: Verify types and lint**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit`
Expected: no errors.

Run: `docker compose -f docker-compose.dev.yml run --rm app npm run lint`
Expected: no errors in the new files.

Note: If `getCompetitionById`'s return type does not include `eventDate` / `discipline.name` directly, inspect `src/lib/competitions/queries.ts` and adapt the access path (the discipline relation is selected for EVENT detail views already). Do not change the query's shape — read what it returns.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/competitions/[id]/starter-list/pdf/route.ts
git commit -m "feat(api): add starter-list PDF route for events"
```

---

## Task 4: UI integration — add `PdfDownloadButton` to event participants page

**Files:**

- Modify: `src/app/(app)/competitions/[id]/participants/page.tsx`

- [ ] **Step 1: Read the file to locate the header action area**

Run: `cat src/app/\(app\)/competitions/\[id\]/participants/page.tsx | head -120`

Identify the `<div className="flex shrink-0 items-center gap-2">` block in the page header that holds existing header actions (around lines 80–90 based on prior inspection). This is where the new button goes.

- [ ] **Step 2: Import the button at the top of the file**

Add the import near the other component imports:

```tsx
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
```

- [ ] **Step 3: Render the button conditionally for EVENT competitions**

Inside the header's right-side action `<div>` (the one with `className="flex shrink-0 items-center gap-2"`), add as the first child:

```tsx
{
  competition.type === "EVENT" && (
    <PdfDownloadButton
      href={`/api/competitions/${id}/starter-list/pdf`}
      label="Starterliste drucken"
    />
  )
}
```

- [ ] **Step 4: Verify type-check and lint pass**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit`
Expected: no errors.

Run: `docker compose -f docker-compose.dev.yml run --rm app npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual smoke check (dev server)**

Run: `docker compose -f docker-compose.dev.yml up -d` (if not already up) and open the participants page of any EVENT competition in the browser. Confirm:

- Button visible on EVENT page
- Click downloads a PDF named `starterliste-<slug>.pdf`
- PDF shows Starterliste title, the enrolled ACTIVE participants with a random Nr. column, their disciplines, and 10 empty rows
- Repeat click → different shuffled order
- For a LEAGUE or SEASON competition → button is NOT rendered
- Visit `/api/competitions/<league-id>/starter-list/pdf` directly → response 400

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/competitions/\[id\]/participants/page.tsx
git commit -m "feat(ui): show 'Starterliste drucken' button on event participants page"
```

---

## Task 5: Doc sync — update `features.md`

**Files:**

- Modify: `.claude/docs/features.md`

- [ ] **Step 1: Locate the Event-Modus section**

Open `.claude/docs/features.md` and find the section `## Event-Modus (EVENT) ✓ IMPLEMENTIERT (Phase 4)` → subsection `### Teilnehmer & Gäste ✓`.

- [ ] **Step 2: Add a new bullet describing the export**

Append a new bullet at the end of the `### Teilnehmer & Gäste ✓` bullet list:

```markdown
- **PDF-Export Starterliste:** Druckbare Starterliste pro Event (`GET /api/competitions/[id]/starter-list/pdf`). Spalten Nr. (zufällig gemischte Startreihenfolge 1..n), Name, Disziplin (pro Zeile befüllt), Einlage (leer), Teilnahme, Geschossen. Nur ACTIVE-Teilnehmer + 10 Leerzeilen für Spontanstarter. Button auf `/competitions/[id]/participants` für EVENT-Wettbewerbe. Nur für ADMIN/MANAGER.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/docs/features.md
git commit -m "docs(features): document event starter-list PDF export"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run /check (full quality gate)**

Run: `docker compose -f docker-compose.dev.yml run --rm app sh -c "npm run lint && npm run format:check && npm run test && npx tsc --noEmit"`
Expected: all green.

- [ ] **Step 2: Write lesson entry**

Append a row to `.claude/tasks/lessons.md` in the table format:
`| 2026-05-24 | <one observation from this session> | <rule that prevents repetition> |`

Pick from the actual session: an observation about Fisher–Yates with injectable RNG, the existing pre-existing `startNumber` field collision avoidance, or the `crypto.randomInt` choice for unbiased shuffling.

- [ ] **Step 3: Run /consolidate-lessons**

Run the `/consolidate-lessons` skill to promote new learnings.

- [ ] **Step 4: Branch completion**

Invoke `superpowers:finishing-a-development-branch` to merge the branch.

---

## Self-Review (notes from the planner)

- **Spec coverage**
  - Nr. column with shuffled order → Task 1 (helper, Fisher–Yates), Task 2 (column rendering)
  - Disziplin per-row, fixed event fallback → Task 1 (test + impl), Task 3 (caller wires `competitionDisciplineName`)
  - Header title/subtitle (date conditional) → Task 2 (component + test)
  - Empty rows blank Nr. → Task 2 (component)
  - Filename slug → Task 3 (`slugify` helper)
  - Auth, type guard, 401/403/404/400 → Task 3
  - Visible only on EVENT → Task 4 (conditional render)
  - Tests for helper (filter, unique 1..n, fixed/mixed discipline, empty list, deterministic shuffle) → Task 1 (7 tests)
  - Tests for PDF component (renders with/without participants, date in subtitle) → Task 2 (3 tests)
  - features.md bullet → Task 5
- **Placeholder scan:** None found.
- **Type consistency:** Helper output `{ nr, firstName, lastName, disciplineName }` matches PDF component props. Route maps `getCompetitionParticipants` rows into the helper's input shape explicitly.
- **Naming note:** the PDF "Nr." field is `nr`, deliberately distinct from the pre-existing persistent `CompetitionParticipant.startNumber` to avoid confusion.
