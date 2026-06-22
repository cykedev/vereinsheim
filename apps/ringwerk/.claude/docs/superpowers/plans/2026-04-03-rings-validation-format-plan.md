# Rings Validation & Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add discipline-aware input validation (max rings, integer constraint) and consistent decimal formatting with German comma notation across all input dialogs, tables, and PDFs.

**Architecture:** A new central module `src/lib/series/scoring-format.ts` provides pure utility functions used by all layers. Data types are extended to carry `disciplineScoringType` / `bestRingsScoringType` so tables and PDFs can format per-row without extra DB calls. Input dialogs receive a `scoringType` prop and use a new thin `RingsInput` wrapper component.

**Tech Stack:** TypeScript, React, Zod, Next.js Server Actions, `@react-pdf/renderer` for PDFs, Vitest for tests.

---

## Required Docs

- `.claude/docs/code-conventions.md` — always
- `.claude/docs/reference-files.md` — always
- `.claude/docs/data-model.md` — always
- `.claude/docs/architecture.md` — always
- `.claude/docs/features.md` — always
- `.claude/docs/ui-patterns.md` — when editing `.tsx` files
- `.claude/docs/superpowers/specs/2026-04-03-rings-validation-format-design.md` — the spec this plan implements

---

## File Map

| Status     | Path                                                      | Change                                                                                                          |
| ---------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Create** | `src/lib/series/scoring-format.ts`                        | Core utilities: `getEffectiveScoringType`, `getMaxRings`, `formatRings`, `formatDecimal1`, `getRingsInputProps` |
| **Create** | `src/lib/series/scoring-format.test.ts`                   | Unit tests for all utilities                                                                                    |
| **Create** | `src/components/app/series/RingsInput.tsx`                | Thin Input wrapper using `getRingsInputProps`                                                                   |
| **Modify** | `src/lib/series/types.ts`                                 | Add `scoringType: ScoringType` to `SeasonSeriesItem.discipline`                                                 |
| **Modify** | `src/lib/competitions/queries.ts`                         | Fetch `scoringType` in season series query; add `scoringMode` to event competition query                        |
| **Modify** | `src/lib/scoring/calculateSeasonStandings.ts`             | Add `bestRingsScoringType: ScoringType \| null` to `SeasonStandingsEntry`                                       |
| **Modify** | `src/lib/scoring/calculateSeasonStandings.test.ts`        | Update `makeSeries` helper, add tests for new field                                                             |
| **Modify** | `src/lib/scoring/rankEventParticipants.ts`                | Add `disciplineScoringType: ScoringType` to `EventRankedEntry`, use `getMaxRings`                               |
| **Modify** | `src/lib/scoring/rankEventParticipants.test.ts`           | Update tests for new field                                                                                      |
| **Modify** | `src/lib/series/actions.ts`                               | Fetch `scoringMode`, add max-rings + integer validation after discipline resolution                             |
| **Modify** | `src/lib/series/actions.test.ts`                          | Add tests for over-max and non-integer rejection                                                                |
| **Modify** | `src/components/app/series/EventSeriesDialog.tsx`         | Add `scoringType: ScoringType` + `shotsPerSeries: number` props, use `RingsInput`                               |
| **Modify** | `src/components/app/series/SeasonSeriesDialog.tsx`        | Extend disciplines with `scoringType`, reactive `RingsInput`                                                    |
| **Modify** | `src/components/app/results/ResultEntryDialog.tsx`        | Add `scoringType: ScoringType` prop, use `RingsInput`                                                           |
| **Modify** | `src/components/app/playoffs/PlayoffDuelResultDialog.tsx` | Add `scoringType: ScoringType` prop, use `RingsInput`                                                           |
| **Modify** | Callers of the 4 dialogs above                            | Pass new props from parent pages                                                                                |
| **Modify** | `src/components/app/series/EventRankingTable.tsx`         | Use `formatRings` (per-row), `formatDecimal1`                                                                   |
| **Modify** | `src/components/app/series/SeasonStandingsTable.tsx`      | Use `formatRings` with `bestRingsScoringType`, `formatDecimal1`                                                 |
| **Modify** | `src/components/app/standings/StandingsTable.tsx`         | Use `formatDecimal1` for ringteiler                                                                             |
| **Modify** | `src/lib/pdf/EventRankingPdf.tsx`                         | Use `formatRings` (per-row), `formatDecimal1`                                                                   |
| **Modify** | `src/lib/pdf/SeasonStandingsPdf.tsx`                      | Replace local formatters with central utilities                                                                 |
| **Modify** | `src/lib/pdf/SchedulePdf.tsx`                             | Use `formatRings`, `formatDecimal1`                                                                             |
| **Modify** | `src/lib/pdf/PlayoffsPdf.tsx`                             | Use `formatRings`, `formatDecimal1`                                                                             |

---

## Task 1: Create `src/lib/series/scoring-format.ts`

**Files:**

- Create: `src/lib/series/scoring-format.ts`
- Create: `src/lib/series/scoring-format.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/series/scoring-format.test.ts
import { describe, it, expect } from "vitest"
import {
  getEffectiveScoringType,
  getMaxRings,
  formatRings,
  formatDecimal1,
  getRingsInputProps,
} from "./scoring-format"

describe("getEffectiveScoringType", () => {
  it("RINGS → WHOLE unabhängig von Disziplin", () => {
    expect(getEffectiveScoringType("RINGS", { scoringType: "DECIMAL" })).toBe("WHOLE")
    expect(getEffectiveScoringType("RINGS", null)).toBe("WHOLE")
  })

  it("RINGS_DECIMAL → DECIMAL unabhängig von Disziplin", () => {
    expect(getEffectiveScoringType("RINGS_DECIMAL", { scoringType: "WHOLE" })).toBe("DECIMAL")
    expect(getEffectiveScoringType("RINGS_DECIMAL", null)).toBe("DECIMAL")
  })

  it("DECIMAL_REST → DECIMAL", () => {
    expect(getEffectiveScoringType("DECIMAL_REST", null)).toBe("DECIMAL")
  })

  it("RINGTEILER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("RINGTEILER", { scoringType: "WHOLE" })).toBe("WHOLE")
    expect(getEffectiveScoringType("RINGTEILER", { scoringType: "DECIMAL" })).toBe("DECIMAL")
  })

  it("TEILER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TEILER", { scoringType: "DECIMAL" })).toBe("DECIMAL")
  })

  it("TARGET_ABSOLUTE → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_ABSOLUTE", { scoringType: "WHOLE" })).toBe("WHOLE")
  })

  it("TARGET_UNDER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_UNDER", { scoringType: "DECIMAL" })).toBe("DECIMAL")
  })

  it("TARGET_OVER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_OVER", { scoringType: "WHOLE" })).toBe("WHOLE")
  })

  it("RINGTEILER ohne Disziplin (gemischt) → WHOLE als Fallback", () => {
    expect(getEffectiveScoringType("RINGTEILER", null)).toBe("WHOLE")
  })
})

describe("getMaxRings", () => {
  it("WHOLE: 10 Schuss → 100", () => {
    expect(getMaxRings("WHOLE", 10)).toBe(100)
  })

  it("WHOLE: 30 Schuss → 300", () => {
    expect(getMaxRings("WHOLE", 30)).toBe(300)
  })

  it("DECIMAL: 10 Schuss → 109", () => {
    expect(getMaxRings("DECIMAL", 10)).toBe(109)
  })

  it("DECIMAL: 5 Schuss → 54.5", () => {
    expect(getMaxRings("DECIMAL", 5)).toBe(54.5)
  })

  it("DECIMAL: 30 Schuss → 327", () => {
    expect(getMaxRings("DECIMAL", 30)).toBe(327)
  })
})

describe("formatRings", () => {
  it("null → Gedankenstrich", () => {
    expect(formatRings(null, "WHOLE")).toBe("–")
    expect(formatRings(null, "DECIMAL")).toBe("–")
  })

  it("WHOLE: ganzzahlig ohne Komma", () => {
    expect(formatRings(96, "WHOLE")).toBe("96")
    expect(formatRings(100, "WHOLE")).toBe("100")
    expect(formatRings(0, "WHOLE")).toBe("0")
  })

  it("DECIMAL: mit deutschem Komma, 1 Stelle", () => {
    expect(formatRings(96.5, "DECIMAL")).toBe("96,5")
    expect(formatRings(109, "DECIMAL")).toBe("109,0")
    expect(formatRings(0, "DECIMAL")).toBe("0,0")
  })
})

describe("formatDecimal1", () => {
  it("null → Gedankenstrich", () => {
    expect(formatDecimal1(null)).toBe("–")
  })

  it("ganzzahlige Werte mit ,0", () => {
    expect(formatDecimal1(12)).toBe("12,0")
    expect(formatDecimal1(0)).toBe("0,0")
  })

  it("Dezimalwerte mit deutschem Komma", () => {
    expect(formatDecimal1(3.7)).toBe("3,7")
    expect(formatDecimal1(9999.9)).toBe("9999,9")
  })
})

describe("getRingsInputProps", () => {
  it("WHOLE: step=1, numeric inputMode", () => {
    const props = getRingsInputProps("WHOLE", 10)
    expect(props.inputMode).toBe("numeric")
    expect(props.step).toBe("1")
    expect(props.placeholder).toBe("z.B. 96")
    expect(props.max).toBe(100)
  })

  it("DECIMAL: step=0.1, decimal inputMode", () => {
    const props = getRingsInputProps("DECIMAL", 10)
    expect(props.inputMode).toBe("decimal")
    expect(props.step).toBe("0.1")
    expect(props.placeholder).toBe("z.B. 96,5")
    expect(props.max).toBe(109)
  })

  it("WHOLE: max skaliert mit Schusszahl", () => {
    expect(getRingsInputProps("WHOLE", 30).max).toBe(300)
  })

  it("DECIMAL: max skaliert mit Schusszahl", () => {
    expect(getRingsInputProps("DECIMAL", 30).max).toBe(327)
  })
})
```

- [ ] **Step 2: Verify tests fail**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/scoring-format.test.ts
```

Expected: error — file not found.

- [ ] **Step 3: Create the module**

```typescript
// src/lib/series/scoring-format.ts
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"

/**
 * Bestimmt den effektiven ScoringType für die Eingabe/Anzeige von Ringen.
 *
 * RINGS          → immer WHOLE (explizit ganzzahlig)
 * RINGS_DECIMAL  → immer DECIMAL
 * DECIMAL_REST   → immer DECIMAL (Nachkommastellen werden summiert)
 * RINGTEILER, TEILER, TARGET_* → folgt der Disziplin; WHOLE als Fallback bei gemischten Wettbewerben
 */
export function getEffectiveScoringType(
  scoringMode: ScoringMode,
  discipline: { scoringType: ScoringType } | null
): ScoringType {
  if (scoringMode === "RINGS") return "WHOLE"
  if (scoringMode === "RINGS_DECIMAL" || scoringMode === "DECIMAL_REST") return "DECIMAL"
  return discipline?.scoringType ?? "WHOLE"
}

/**
 * Maximale Ringe für eine Serie in Abhängigkeit von ScoringType und Schusszahl.
 * WHOLE:   shotsPerSeries × 10
 * DECIMAL: shotsPerSeries × 10.9
 */
export function getMaxRings(scoringType: ScoringType, shotsPerSeries: number): number {
  if (scoringType === "DECIMAL") return shotsPerSeries * 10.9
  return shotsPerSeries * 10
}

/**
 * Formatiert einen Ringe-Wert für die Anzeige in Tabellen und PDFs.
 * WHOLE:   ganzzahlig, kein Dezimalzeichen  ("96")
 * DECIMAL: deutsches Komma, 1 Stelle        ("96,5" | "109,0")
 */
export function formatRings(value: number | null, scoringType: ScoringType): string {
  if (value === null) return "–"
  if (scoringType === "DECIMAL") return value.toFixed(1).replace(".", ",")
  return String(Math.round(value))
}

/**
 * Formatiert Teiler- und Ringteiler-Werte für die Anzeige.
 * Immer: deutsches Komma, 1 Nachkommastelle ("3,7" | "12,0")
 */
export function formatDecimal1(value: number | null): string {
  if (value === null) return "–"
  return value.toFixed(1).replace(".", ",")
}

/**
 * Liefert die HTML-Input-Props für das RingsInput-Feld.
 * Wird von RingsInput.tsx intern genutzt.
 */
export function getRingsInputProps(
  scoringType: ScoringType,
  shotsPerSeries: number
): {
  inputMode: "numeric" | "decimal"
  placeholder: string
  step: string
  max: number
} {
  const max = getMaxRings(scoringType, shotsPerSeries)
  if (scoringType === "DECIMAL") {
    return { inputMode: "decimal", placeholder: "z.B. 96,5", step: "0.1", max }
  }
  return { inputMode: "numeric", placeholder: "z.B. 96", step: "1", max }
}
```

- [ ] **Step 4: Verify tests pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/scoring-format.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/series/scoring-format.ts src/lib/series/scoring-format.test.ts
git commit -m "feat: add scoring-format utilities for rings validation and display"
```

---

## Task 2: Add `scoringType` to `SeasonSeriesItem` and DB query

**Files:**

- Modify: `src/lib/series/types.ts`
- Modify: `src/lib/competitions/queries.ts:205-218`

- [ ] **Step 1: Update `SeasonSeriesItem` type**

In `src/lib/series/types.ts`, update the `SeasonSeriesItem` type (line 38–53). Change the `discipline` field:

```typescript
export type SeasonSeriesItem = {
  id: string
  participantId: string
  disciplineId: string
  discipline: {
    name: string
    teilerFaktor: number
    scoringType: ScoringType
  }
  rings: number
  teiler: number
  ringteiler: number
  shotCount: number
  sessionDate: Date
}
```

- [ ] **Step 2: Update the DB query in `queries.ts`**

In `src/lib/competitions/queries.ts`, find the `seriesRows` query (line ~205). Change the discipline select from:

```typescript
discipline: { select: { name: true, teilerFaktor: true } },
```

to:

```typescript
discipline: { select: { name: true, teilerFaktor: true, scoringType: true } },
```

Then update the item mapping (line ~228–231) from:

```typescript
discipline: {
  name: s.discipline.name,
  teilerFaktor: s.discipline.teilerFaktor.toNumber(),
},
```

to:

```typescript
discipline: {
  name: s.discipline.name,
  teilerFaktor: s.discipline.teilerFaktor.toNumber(),
  scoringType: s.discipline.scoringType,
},
```

- [ ] **Step 3: Update `calculateSeasonStandings.test.ts` helper**

The `makeSeries` helper in `src/lib/scoring/calculateSeasonStandings.test.ts` uses `SeasonSeriesItem`. Add `scoringType` to the discipline:

```typescript
function makeSeries(
  participantId: string,
  overrides: Partial<SeasonSeriesItem> & { rings: number; teiler: number; ringteiler: number }
): SeasonSeriesItem {
  return {
    id: `series-${Math.random()}`,
    participantId,
    disciplineId: "disc-1",
    discipline: { name: "LP", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
    shotCount: 10,
    sessionDate: new Date("2026-01-15"),
    ...overrides,
  }
}
```

- [ ] **Step 4: Run tests to confirm no regressions**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateSeasonStandings.test.ts
```

Expected: all tests PASS (no behavior change yet, only type extension).

- [ ] **Step 5: Commit**

```bash
git add src/lib/series/types.ts src/lib/competitions/queries.ts src/lib/scoring/calculateSeasonStandings.test.ts
git commit -m "feat: add scoringType to SeasonSeriesItem and season series DB query"
```

---

## Task 3: Add `bestRingsScoringType` to `SeasonStandingsEntry`

**Files:**

- Modify: `src/lib/scoring/calculateSeasonStandings.ts`
- Modify: `src/lib/scoring/calculateSeasonStandings.test.ts`

- [ ] **Step 1: Write failing test**

Add to `calculateSeasonStandings.test.ts`, inside the `describe("Beste Ringe", ...)` block (after existing tests):

```typescript
it("gibt scoringType der bestRings-Serie zurück (WHOLE)", () => {
  const result = calculateSeasonStandings(
    [
      {
        participantId: "p1",
        participantName: "Müller, Max",
        series: [
          makeSeries("p1", { rings: 92, teiler: 5.0, ringteiler: 13.0 }),
          makeSeries("p1", { rings: 96, teiler: 3.7, ringteiler: 7.7 }), // bestRings
        ],
      },
    ],
    null
  )
  expect(result[0].bestRingsScoringType).toBe("WHOLE")
})

it("gibt scoringType der bestRings-Serie zurück (DECIMAL)", () => {
  const result = calculateSeasonStandings(
    [
      {
        participantId: "p1",
        participantName: "Müller, Max",
        series: [
          makeSeries("p1", {
            rings: 104.5,
            teiler: 2.1,
            ringteiler: 6.6,
            discipline: { name: "LGA", teilerFaktor: 1.8, scoringType: "DECIMAL" as const },
          }),
        ],
      },
    ],
    null
  )
  expect(result[0].bestRingsScoringType).toBe("DECIMAL")
})

it("gibt null zurück wenn keine Serien", () => {
  const result = calculateSeasonStandings(
    [{ participantId: "p1", participantName: "Müller, Max", series: [] }],
    null
  )
  expect(result[0].bestRingsScoringType).toBeNull()
})
```

- [ ] **Step 2: Verify tests fail**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateSeasonStandings.test.ts
```

Expected: FAIL — `bestRingsScoringType` not a known property.

- [ ] **Step 3: Update `SeasonStandingsEntry` type**

In `src/lib/scoring/calculateSeasonStandings.ts`, add to `SeasonStandingsEntry`:

```typescript
import type { ScoringType } from "@/generated/prisma/client"

export type SeasonStandingsEntry = {
  participantId: string
  participantName: string
  seriesCount: number
  meetsMinSeries: boolean
  bestRings: number | null
  bestRingsScoringType: ScoringType | null // <-- new
  bestRings_rank: number | null
  bestCorrectedTeiler: number | null
  bestTeiler_rank: number | null
  bestRingteiler: number | null
  bestRingteiler_rank: number | null
}
```

- [ ] **Step 4: Update the calculation logic**

In `calculateSeasonStandings`, replace the bestRings calculation (line ~60–61):

```typescript
// Before (find max):
const bestRings = Math.max(...p.series.map((s) => s.rings))
```

Replace with:

```typescript
// Track the series with highest rings
const bestRingsSeries = p.series.reduce((best, s) => (s.rings > best.rings ? s : best), p.series[0])
const bestRings = bestRingsSeries.rings
const bestRingsScoringType = bestRingsSeries.discipline.scoringType
```

In the return object inside `.map((p) => ...)` add `bestRingsScoringType`:

```typescript
return {
  participantId: p.participantId,
  participantName: p.participantName,
  seriesCount,
  meetsMinSeries,
  bestRings,
  bestRingsScoringType,
  bestCorrectedTeiler,
  bestRingteiler,
}
```

For the empty series case, add `bestRingsScoringType: null`:

```typescript
if (seriesCount === 0) {
  return {
    participantId: p.participantId,
    participantName: p.participantName,
    seriesCount,
    meetsMinSeries,
    bestRings: null,
    bestRingsScoringType: null,
    bestCorrectedTeiler: null,
    bestRingteiler: null,
  }
}
```

- [ ] **Step 5: Verify tests pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateSeasonStandings.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring/calculateSeasonStandings.ts src/lib/scoring/calculateSeasonStandings.test.ts
git commit -m "feat: add bestRingsScoringType to SeasonStandingsEntry"
```

---

## Task 4: Add `disciplineScoringType` to `EventRankedEntry`

**Files:**

- Modify: `src/lib/scoring/rankEventParticipants.ts`
- Modify: `src/lib/scoring/rankEventParticipants.test.ts`

- [ ] **Step 1: Write failing test**

In `src/lib/scoring/rankEventParticipants.test.ts`, find the RINGTEILER describe block and add:

```typescript
it("enthält disciplineScoringType aus der Disziplin der Serie", () => {
  const series = [
    makeSeries({
      participantId: "p1",
      rings: 96,
      teiler: 3.7,
      discipline: { name: "LG", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
    }),
    makeSeries({
      participantId: "p2",
      rings: 104.5,
      teiler: 2.1,
      discipline: { name: "LGA", teilerFaktor: 1.8, scoringType: "DECIMAL" as const },
    }),
  ]
  const result = rankEventParticipants(series, BASE_CONFIG)
  const p1 = result.find((e) => e.participantId === "p1")!
  const p2 = result.find((e) => e.participantId === "p2")!
  expect(p1.disciplineScoringType).toBe("WHOLE")
  expect(p2.disciplineScoringType).toBe("DECIMAL")
})
```

- [ ] **Step 2: Verify test fails**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/rankEventParticipants.test.ts
```

Expected: FAIL — `disciplineScoringType` not a property.

- [ ] **Step 3: Update `EventRankedEntry` type and implementation**

In `src/lib/scoring/rankEventParticipants.ts`:

Add `import type { ScoringMode, ScoringType, TargetValueType } from "@/generated/prisma/client"` (update existing import to include `ScoringType`).

Add `disciplineScoringType: ScoringType` to `EventRankedEntry`:

```typescript
export type EventRankedEntry = {
  rank: number
  seriesId: string
  competitionParticipantId: string | null
  participantId: string
  participantName: string
  disciplineName: string
  disciplineScoringType: ScoringType // <-- new
  isGuest: boolean
  teamNumber: number | null
  rings: number
  teiler: number
  correctedTeiler: number
  ringteiler: number
  score: number
}
```

Also remove the local `MAX_RINGS` constant (line 6) and import `getMaxRings` instead:

```typescript
import { getMaxRings } from "@/lib/series/scoring-format"
```

Update the local const in `rankEventParticipants` from:

```typescript
const maxRings = MAX_RINGS[s.discipline.scoringType]
```

to:

```typescript
const maxRings = getMaxRings(s.discipline.scoringType, 10) // shotsPerSeries not available here; per-series maxRings via discipline
```

Wait — the old code uses `s.discipline.scoringType` directly as a key to the local `MAX_RINGS` record. The `getMaxRings` function requires `shotsPerSeries`. Since `rankEventParticipants` doesn't currently have `shotsPerSeries` in its config, keep using `s.discipline.scoringType` to derive max: replace `MAX_RINGS[s.discipline.scoringType]` with `getMaxRings(s.discipline.scoringType, 10)`.

**Note:** The shotsPerSeries is not passed to `rankEventParticipants` — the old hardcoded `MAX_RINGS` used 10 shots as an implicit default. This is unchanged behaviour. A future task could add `shotsPerSeries` to `EventConfig` if needed; for now, keep 10.

In the `entries` mapping return object, add `disciplineScoringType`:

```typescript
return {
  seriesId: s.id,
  competitionParticipantId: s.competitionParticipantId,
  participantId: s.participantId,
  participantName: `${s.participant.firstName} ${s.participant.lastName}`,
  disciplineName: s.discipline.name,
  disciplineScoringType: s.discipline.scoringType, // <-- new
  isGuest: s.isGuest,
  teamNumber: s.teamNumber,
  rings: s.rings,
  teiler: s.teiler,
  correctedTeiler,
  ringteiler: s.ringteiler,
  score,
}
```

- [ ] **Step 4: Verify tests pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/rankEventParticipants.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/rankEventParticipants.ts src/lib/scoring/rankEventParticipants.test.ts
git commit -m "feat: add disciplineScoringType to EventRankedEntry"
```

---

## Task 5: Add server-side validation to `actions.ts`

**Files:**

- Modify: `src/lib/series/actions.ts`
- Modify: `src/lib/series/actions.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/lib/series/actions.test.ts`, inside `describe("saveEventSeries", ...)`, add after the existing validation tests:

```typescript
it("liefert Fehler wenn Ringe über Maximum (WHOLE, 10 Schuss → max 100)", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  competitionFindUniqueMock.mockResolvedValue({
    ...eventCompetition,
    scoringMode: "RINGTEILER",
    shotsPerSeries: 10,
  })
  competitionParticipantFindUniqueMock.mockResolvedValue(cpWithDiscipline) // scoringType: WHOLE
  const fd = makeFormData({ rings: "101", teiler: "3.7" })
  const result = await saveEventSeries("c1", "cp1", null, fd)
  expect(result).toMatchObject({
    error: { rings: expect.arrayContaining([expect.stringContaining("100")]) },
  })
})

it("liefert Fehler wenn Ringe nicht ganzzahlig bei WHOLE-Disziplin", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  competitionFindUniqueMock.mockResolvedValue({
    ...eventCompetition,
    scoringMode: "RINGTEILER",
    shotsPerSeries: 10,
  })
  competitionParticipantFindUniqueMock.mockResolvedValue(cpWithDiscipline) // scoringType: WHOLE
  const fd = makeFormData({ rings: "95.5", teiler: "3.7" })
  const result = await saveEventSeries("c1", "cp1", null, fd)
  expect(result).toMatchObject({
    error: { rings: expect.arrayContaining([expect.stringContaining("ganze")]) },
  })
})

it("akzeptiert Dezimalringe bei DECIMAL-Disziplin", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  const decimalDiscipline = { ...discipline, scoringType: "DECIMAL" as const }
  competitionFindUniqueMock.mockResolvedValue({
    ...eventCompetition,
    scoringMode: "RINGTEILER",
    shotsPerSeries: 10,
  })
  competitionParticipantFindUniqueMock.mockResolvedValue({
    ...cpWithDiscipline,
    discipline: decimalDiscipline,
  })
  seriesFindUniqueMock.mockResolvedValue(null)
  const fd = makeFormData({ rings: "104.5", teiler: "2.1" })
  const result = await saveEventSeries("c1", "cp1", null, fd)
  expect(result).not.toMatchObject({ error: { rings: expect.anything() } })
})
```

**Note:** The existing `eventCompetition` fixture in the test file does not have `scoringMode`. Add it to the fixture object: `scoringMode: "RINGTEILER" as const`. Similarly for `seasonCompetition`.

Also add the same three tests for `saveSeasonSeries` inside `describe("saveSeasonSeries", ...)`.

- [ ] **Step 2: Verify tests fail**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts
```

Expected: new tests FAIL (no max/integer validation yet). Existing tests still PASS.

- [ ] **Step 3: Update `actions.ts`**

Add import at the top of `src/lib/series/actions.ts`:

```typescript
import { getEffectiveScoringType, getMaxRings } from "@/lib/series/scoring-format"
```

In `saveEventSeries`, the competition select already has `shotsPerSeries` and `disciplineId`. Add `scoringMode` to the competition select:

```typescript
const competition = await db.competition.findUnique({
  where: { id: competitionId },
  select: {
    id: true,
    type: true,
    status: true,
    scoringMode: true, // <-- add this
    shotsPerSeries: true,
    disciplineId: true,
  },
})
```

After the `SeriesSchema.safeParse()` block (after `const { rings, teiler } = parsed.data`), add validation before the teilerFaktor line:

```typescript
const { rings, teiler } = parsed.data

// Max-Ringe und Integer-Constraint prüfen
const effectiveScoringType = getEffectiveScoringType(competition.scoringMode, discipline)
const maxRings = getMaxRings(effectiveScoringType, competition.shotsPerSeries)
if (rings > maxRings) {
  return {
    error: {
      rings: [
        `Maximal ${effectiveScoringType === "DECIMAL" ? maxRings.toFixed(1).replace(".", ",") : maxRings} Ringe erlaubt`,
      ],
    },
  }
}
if (effectiveScoringType === "WHOLE" && !Number.isInteger(rings)) {
  return { error: { rings: ["Nur ganze Ringe erlaubt"] } }
}
```

Apply the exact same pattern to `saveSeasonSeries` and `updateSeasonSeries` in the same file. In those actions, add `scoringMode: true` to the competition select, then insert the same validation block after schema parsing.

- [ ] **Step 4: Verify tests pass**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/series/actions.ts src/lib/series/actions.test.ts
git commit -m "feat: add max-rings and integer validation to series actions"
```

---

## Task 6: Create `RingsInput` component

**Files:**

- Create: `src/components/app/series/RingsInput.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/app/series/RingsInput.tsx
"use client"

import { Input } from "@/components/ui/input"
import { getRingsInputProps } from "@/lib/series/scoring-format"
import type { ScoringType } from "@/generated/prisma/client"
import type { ComponentProps } from "react"

interface Props extends Omit<ComponentProps<typeof Input>, "inputMode" | "step" | "placeholder"> {
  scoringType: ScoringType
  shotsPerSeries: number
}

/**
 * Input for rings values — sets inputMode, step, placeholder and max
 * based on the effective ScoringType of the current context.
 */
export function RingsInput({ scoringType, shotsPerSeries, ...rest }: Props) {
  const { inputMode, placeholder, step, max } = getRingsInputProps(scoringType, shotsPerSeries)
  return (
    <Input
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      step={step}
      max={max}
      {...rest}
    />
  )
}
```

- [ ] **Step 2: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/series/RingsInput.tsx
git commit -m "feat: add RingsInput component with automatic scoring-type-aware props"
```

---

## Task 7: Update `EventSeriesDialog`

**Files:**

- Modify: `src/components/app/series/EventSeriesDialog.tsx`
- Modify: callers of `EventSeriesDialog` (find with `grep -r "EventSeriesDialog" src/`)

- [ ] **Step 1: Find all callers**

```bash
docker compose -f docker-compose.dev.yml run --rm app grep -r "EventSeriesDialog" src/ --include="*.tsx" -l
```

Note the files — they need updated props.

- [ ] **Step 2: Update `EventSeriesDialog`**

Add `scoringType` and `shotsPerSeries` to the Props interface:

```typescript
import { RingsInput } from "@/components/app/series/RingsInput"
import type { ScoringType } from "@/generated/prisma/client"

interface Props {
  competitionId: string
  competitionParticipantId: string
  participantName: string
  scoringType: ScoringType        // <-- new
  shotsPerSeries: number          // <-- new
  existingSeries?: { rings: number; teiler: number }
}

export function EventSeriesDialog({
  competitionId,
  competitionParticipantId,
  participantName,
  scoringType,
  shotsPerSeries,
  existingSeries,
}: Props) {
```

Replace the rings `<Input>` block with `<RingsInput>`:

```tsx
<div className="space-y-2">
  <Label htmlFor="rings">Gesamtringe</Label>
  <RingsInput
    id="rings"
    name="rings"
    scoringType={scoringType}
    shotsPerSeries={shotsPerSeries}
    defaultValue={existingSeries?.rings ?? ""}
    disabled={isPending}
    autoFocus
  />
  {fieldErrors?.rings && <p className="text-sm text-destructive">{fieldErrors.rings[0]}</p>}
</div>
```

Fix the Teiler placeholder (change `"z.B. 3.7"` → `"z.B. 3,7"`):

```tsx
<Input
  id="teiler"
  name="teiler"
  type="text"
  inputMode="decimal"
  defaultValue={existingSeries?.teiler ?? ""}
  placeholder="z.B. 3,7"
  disabled={isPending}
/>
```

- [ ] **Step 3: Update callers**

For each caller file found in Step 1: add `scoringType={...}` and `shotsPerSeries={...}` props. These values come from the competition data already loaded on the page. Look for `competition.discipline?.scoringType` and `competition.shotsPerSeries`.

Example — a page that renders `EventSeriesDialog` will already have competition data:

```tsx
<EventSeriesDialog
  competitionId={competition.id}
  competitionParticipantId={cp.id}
  participantName={cp.participantName}
  scoringType={getEffectiveScoringType(competition.scoringMode, competition.discipline)}
  shotsPerSeries={competition.shotsPerSeries}
/>
```

Import `getEffectiveScoringType` in the caller:

```typescript
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
```

- [ ] **Step 4: Type-check and test**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/series/EventSeriesDialog.tsx
git add $(grep -r "EventSeriesDialog" src/ --include="*.tsx" -l)
git commit -m "feat: update EventSeriesDialog with RingsInput and scoring-type-aware validation"
```

---

## Task 8: Update `SeasonSeriesDialog`

**Files:**

- Modify: `src/components/app/series/SeasonSeriesDialog.tsx`
- Modify: callers of `SeasonSeriesDialog`

- [ ] **Step 1: Find all callers**

```bash
docker compose -f docker-compose.dev.yml run --rm app grep -r "SeasonSeriesDialog" src/ --include="*.tsx" -l
```

- [ ] **Step 2: Update `SeasonSeriesDialog`**

Add imports:

```typescript
import { useState, useActionState, useEffect } from "react"
import { RingsInput } from "@/components/app/series/RingsInput"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
```

Update Props interface — extend `disciplines` with `scoringType`, add `scoringMode`:

```typescript
interface Props {
  competitionId: string
  participantId: string
  participantName: string
  scoringMode: ScoringMode // <-- new
  disciplines?: { id: string; name: string; scoringType: ScoringType }[] // <-- scoringType added
  defaultDisciplineId?: string | null
  existingSeries?: ExistingSeries
}
```

Destructure `scoringMode` in the component:

```typescript
export function SeasonSeriesDialog({
  competitionId,
  participantId,
  participantName,
  scoringMode,
  disciplines,
  defaultDisciplineId,
  existingSeries,
}: Props) {
  const isMixed = disciplines && disciplines.length > 0

  // Track selected discipline for reactive RingsInput
  const initialDisciplineId =
    existingSeries?.disciplineId ?? defaultDisciplineId ?? disciplines?.[0]?.id ?? null
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(
    initialDisciplineId
  )

  // Reset when dialog opens again
  useEffect(() => {
    if (!open) {
      setSelectedDisciplineId(initialDisciplineId)
    }
  }, [open, initialDisciplineId])

  // Effective scoringType: from selected discipline (mixed) or scoringMode (single)
  const selectedDiscipline = disciplines?.find((d) => d.id === selectedDisciplineId) ?? null
  const effectiveScoringType = getEffectiveScoringType(scoringMode, selectedDiscipline)
```

Update the Select to be controlled:

```tsx
<Select
  name="disciplineId"
  value={selectedDisciplineId ?? undefined}
  onValueChange={setSelectedDisciplineId}
  disabled={isPending}
>
```

Replace the rings `<Input>` with `<RingsInput>`:

```tsx
<div className="space-y-2">
  <Label htmlFor="rings">Gesamtringe</Label>
  <RingsInput
    id="rings"
    name="rings"
    scoringType={effectiveScoringType}
    shotsPerSeries={10}
    placeholder={undefined}
    defaultValue={existingSeries?.rings ?? ""}
    disabled={isPending}
  />
  {fieldErrors?.rings && <p className="text-sm text-destructive">{fieldErrors.rings[0]}</p>}
</div>
```

**Note:** `shotsPerSeries` should come from the competition. Add it as a prop:

```typescript
interface Props {
  // ...existing props...
  shotsPerSeries: number // <-- add
}
```

And use it: `<RingsInput scoringType={effectiveScoringType} shotsPerSeries={shotsPerSeries} ... />`

Fix Teiler placeholder: `placeholder="z.B. 3,7"`.

- [ ] **Step 3: Update callers**

For each caller: add `scoringMode={competition.scoringMode}`, `shotsPerSeries={competition.shotsPerSeries}`, and ensure `disciplines` items include `scoringType`. The discipline query on the page needs to include `scoringType: true` in the select.

- [ ] **Step 4: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/series/SeasonSeriesDialog.tsx
git add $(grep -r "SeasonSeriesDialog" src/ --include="*.tsx" -l)
git commit -m "feat: update SeasonSeriesDialog with reactive RingsInput per discipline"
```

---

## Task 9: Update `ResultEntryDialog`

**Files:**

- Modify: `src/components/app/results/ResultEntryDialog.tsx`
- Modify: callers of `ResultEntryDialog`

- [ ] **Step 1: Find all callers**

```bash
docker compose -f docker-compose.dev.yml run --rm app grep -r "ResultEntryDialog" src/ --include="*.tsx" -l
```

- [ ] **Step 2: Update `ResultEntryDialog`**

Add imports:

```typescript
import { RingsInput } from "@/components/app/series/RingsInput"
import type { ScoringType } from "@/generated/prisma/client"
```

Add to Props interface:

```typescript
interface Props {
  // ...existing props...
  scoringType: ScoringType // <-- new
  shotsPerSeries: number // <-- new
}
```

Destructure in the function signature.

Replace all four `<Input type="number" step="0.1" ...>` rings inputs with `<RingsInput>`:

**Home rings** (replace lines ~147–155):

```tsx
<RingsInput
  id="home-rings"
  scoringType={scoringType}
  shotsPerSeries={shotsPerSeries}
  value={home.rings}
  onChange={(e) => setHome((p) => ({ ...p, rings: e.target.value }))}
/>
```

**Away rings** (replace lines ~188–196):

```tsx
<RingsInput
  id="away-rings"
  scoringType={scoringType}
  shotsPerSeries={shotsPerSeries}
  value={away.rings}
  onChange={(e) => setAway((p) => ({ ...p, rings: e.target.value }))}
/>
```

Fix both Teiler placeholders (home-teiler, away-teiler): change `"z.B. 3.7"` → `"z.B. 3,7"` and `"z.B. 5.0"` → `"z.B. 5,0"`. Keep them as `<Input type="text" inputMode="decimal">`.

- [ ] **Step 3: Update callers**

For each caller: add `scoringType` and `shotsPerSeries` props. The caller pages have competition data. Use:

```typescript
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
// ...
scoringType={getEffectiveScoringType(competition.scoringMode, competition.discipline)}
shotsPerSeries={competition.shotsPerSeries}
```

For mixed Liga (competition.discipline = null), `getEffectiveScoringType` will return `WHOLE` as fallback — client-side is lenient, server validates correctly.

- [ ] **Step 4: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/results/ResultEntryDialog.tsx
git add $(grep -r "ResultEntryDialog" src/ --include="*.tsx" -l)
git commit -m "feat: update ResultEntryDialog with RingsInput and corrected Teiler placeholders"
```

---

## Task 10: Update `PlayoffDuelResultDialog`

**Files:**

- Modify: `src/components/app/playoffs/PlayoffDuelResultDialog.tsx`
- Modify: callers of `PlayoffDuelResultDialog`

- [ ] **Step 1: Find all callers**

```bash
docker compose -f docker-compose.dev.yml run --rm app grep -r "PlayoffDuelResultDialog" src/ --include="*.tsx" -l
```

- [ ] **Step 2: Update `PlayoffDuelResultDialog`**

Add imports:

```typescript
import { RingsInput } from "@/components/app/series/RingsInput"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
```

Add to Props interface:

```typescript
interface Props {
  // ...existing props...
  scoringType: ScoringType // <-- new
}
```

Destructure in function signature.

Replace all four `<Input type="number" step="0.1" ...>` rings inputs (for A and B, inside the dialog) with `<RingsInput>`:

**Participant A rings** (replace lines ~172–181):

```tsx
<RingsInput
  id="a-rings"
  scoringType={scoringType}
  shotsPerSeries={shotsPerSeries}
  value={fieldA.totalRings}
  onChange={(e) => setFieldA((p) => ({ ...p, totalRings: e.target.value }))}
  disabled={isPending}
/>
```

**Participant B rings** (replace lines ~220–229):

```tsx
<RingsInput
  id="b-rings"
  scoringType={scoringType}
  shotsPerSeries={shotsPerSeries}
  value={fieldB.totalRings}
  onChange={(e) => setFieldB((p) => ({ ...p, totalRings: e.target.value }))}
  disabled={isPending}
/>
```

Fix Teiler placeholders: `"z.B. 3.7"` → `"z.B. 3,7"`. Keep as `<Input type="text" inputMode="decimal">`.

- [ ] **Step 3: Update callers**

For each caller: add `scoringType` prop. Use:

```typescript
scoringType={getEffectiveScoringType(competition.scoringMode, competition.discipline)}
```

- [ ] **Step 4: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/playoffs/PlayoffDuelResultDialog.tsx
git add $(grep -r "PlayoffDuelResultDialog" src/ --include="*.tsx" -l)
git commit -m "feat: update PlayoffDuelResultDialog with RingsInput and corrected Teiler placeholders"
```

---

## Task 11: Update display tables

**Files:**

- Modify: `src/components/app/series/EventRankingTable.tsx`
- Modify: `src/components/app/series/SeasonStandingsTable.tsx`
- Modify: `src/components/app/standings/StandingsTable.tsx`

- [ ] **Step 1: Update `EventRankingTable`**

The table already receives `scoringMode: string`. Change the prop type to `ScoringMode` for type safety. Add import:

```typescript
import { formatRings, formatDecimal1, getEffectiveScoringType } from "@/lib/series/scoring-format"
import type { ScoringMode } from "@/generated/prisma/client"
```

Change the rings column (line ~67):

```tsx
// Before:
<td className="px-3 py-2 text-right tabular-nums">{entry.rings}</td>

// After:
<td className="px-3 py-2 text-right tabular-nums">
  {formatRings(entry.rings, getEffectiveScoringType(scoringMode, { scoringType: entry.disciplineScoringType }))}
</td>
```

Change the Teiler column (line ~69):

```tsx
// Before:
{
  isMixed ? entry.correctedTeiler.toFixed(1) : entry.teiler.toFixed(1)
}

// After:
{
  formatDecimal1(isMixed ? entry.correctedTeiler : entry.teiler)
}
```

- [ ] **Step 2: Update `SeasonStandingsTable`**

Add import:

```typescript
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
```

Change bestRings display (line ~151):

```tsx
// Before:
<span>{entry.bestRings}</span>

// After:
<span>{formatRings(entry.bestRings, entry.bestRingsScoringType ?? "WHOLE")}</span>
```

Change bestCorrectedTeiler display (line ~163):

```tsx
// Before:
<span>{entry.bestCorrectedTeiler.toFixed(1)}</span>

// After:
<span>{formatDecimal1(entry.bestCorrectedTeiler)}</span>
```

Change bestRingteiler display (line ~175):

```tsx
// Before:
<span>{entry.bestRingteiler.toFixed(1)}</span>

// After:
<span>{formatDecimal1(entry.bestRingteiler)}</span>
```

- [ ] **Step 3: Update `StandingsTable`**

Add import:

```typescript
import { formatDecimal1 } from "@/lib/series/scoring-format"
```

Change ringteiler display (line ~109):

```tsx
// Before:
{
  row.bestRingteiler !== null ? row.bestRingteiler.toFixed(1) : "—"
}

// After:
{
  formatDecimal1(row.bestRingteiler)
}
```

- [ ] **Step 4: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/series/EventRankingTable.tsx src/components/app/series/SeasonStandingsTable.tsx src/components/app/standings/StandingsTable.tsx
git commit -m "feat: use central formatRings/formatDecimal1 in standings and ranking tables"
```

---

## Task 12: Update `EventRankingPdf`

**Files:**

- Modify: `src/lib/pdf/EventRankingPdf.tsx`

- [ ] **Step 1: Update the PDF**

Add import:

```typescript
import { formatRings, formatDecimal1, getEffectiveScoringType } from "@/lib/series/scoring-format"
import type { ScoringMode } from "@/generated/prisma/client"
```

The component receives `entries: EventRankedEntry[]` and `scoringMode: string`. Change `scoringMode` type to `ScoringMode`.

Change teilerValue (line ~151):

```typescript
// Before:
const teilerValue = isMixed ? entry.correctedTeiler.toFixed(1) : entry.teiler.toFixed(1)

// After:
const teilerValue = formatDecimal1(isMixed ? entry.correctedTeiler : entry.teiler)
```

Change rings display (line ~176):

```tsx
// Before:
<Text style={[styles.tableCell, { width: W.rings }]}>{entry.rings}</Text>

// After:
<Text style={[styles.tableCell, { width: W.rings }]}>
  {formatRings(entry.rings, getEffectiveScoringType(scoringMode, { scoringType: entry.disciplineScoringType }))}
</Text>
```

- [ ] **Step 2: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/EventRankingPdf.tsx
git commit -m "feat: use central formatRings/formatDecimal1 in EventRankingPdf"
```

---

## Task 13: Update `SeasonStandingsPdf`

**Files:**

- Modify: `src/lib/pdf/SeasonStandingsPdf.tsx`

- [ ] **Step 1: Update the PDF**

Add import at the top:

```typescript
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
```

Delete the three local formatter functions (lines ~29–42):

- `function formatRings(value: number | null): string { ... }`
- `function formatTeiler(value: number | null): string { ... }`
- `function formatRingteiler(value: number | null): string { ... }`

The `formatRings` call in the PDF passes only one argument (no scoringType). Update all calls:

```tsx
// Before:
value={formatRings(entry.bestRings)}

// After:
value={formatRings(entry.bestRings, entry.bestRingsScoringType ?? "WHOLE")}
```

Replace `formatTeiler(...)` calls → `formatDecimal1(...)`.
Replace `formatRingteiler(...)` calls → `formatDecimal1(...)`.

- [ ] **Step 2: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/SeasonStandingsPdf.tsx
git commit -m "feat: replace local PDF formatters with central utilities in SeasonStandingsPdf"
```

---

## Task 14: Update `SchedulePdf` and `PlayoffsPdf`

**Files:**

- Modify: `src/lib/pdf/SchedulePdf.tsx`
- Modify: `src/lib/pdf/PlayoffsPdf.tsx`

- [ ] **Step 1: Check what props these PDFs receive**

Run:

```bash
docker compose -f docker-compose.dev.yml run --rm app grep -n "function.*Pdf\|interface.*Props\|scoringType\|discipline" src/lib/pdf/SchedulePdf.tsx src/lib/pdf/PlayoffsPdf.tsx
```

Note the prop types. Both PDFs display Liga match results — they need `scoringType: ScoringType` to format rings correctly. If the competition has a discipline, use `discipline.scoringType`. For mixed Liga (no discipline), default to `"WHOLE"`.

- [ ] **Step 2: Update `SchedulePdf`**

Add import:

```typescript
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import type { ScoringType } from "@/generated/prisma/client"
```

Add `scoringType: ScoringType` to the Props interface of `SchedulePdf` (and any sub-components that display ring values).

Delete the local `formatRT` function (lines ~25–28).

Update rings display (line ~170):

```tsx
// Before:
{
  ;`${result.rings.toFixed(0)} R \u00b7 T ${result.teiler.toFixed(1)} \u00b7 RT `
}

// After:
{
  ;`${formatRings(result.rings, scoringType)} R \u00b7 T ${formatDecimal1(result.teiler)} \u00b7 RT `
}
```

Update ringteiler display (line ~171):

```tsx
// Before:
<Text ...>{result.ringteiler.toFixed(1)}</Text>

// After:
<Text ...>{formatDecimal1(result.ringteiler)}</Text>
```

Pass `scoringType` through to any sub-component that renders match result rows.

Update callers of `SchedulePdf` to pass `scoringType={competition.discipline?.scoringType ?? "WHOLE"}`.

- [ ] **Step 3: Update `PlayoffsPdf`**

Add import:

```typescript
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import type { ScoringType } from "@/generated/prisma/client"
```

Add `scoringType: ScoringType` to props.

Update `totalRings.toFixed(0)` (line ~413):

```tsx
// Before:
return `${duel.resultA.totalRings.toFixed(0)} R  vs  ${duel.resultB.totalRings.toFixed(0)} R`

// After:
return `${formatRings(duel.resultA.totalRings, scoringType)} R  vs  ${formatRings(duel.resultB.totalRings, scoringType)} R`
```

Update ringteiler `.toFixed(1)` (lines ~415–416):

```tsx
const rtA = formatDecimal1(duel.resultA.ringteiler ?? null)
const rtB = formatDecimal1(duel.resultB.ringteiler ?? null)
```

Update callers of `PlayoffsPdf` to pass `scoringType`.

- [ ] **Step 4: Type-check**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/SchedulePdf.tsx src/lib/pdf/PlayoffsPdf.tsx
git add $(grep -r "SchedulePdf\|PlayoffsPdf" src/ --include="*.tsx" -l)
git commit -m "feat: use central formatRings/formatDecimal1 in SchedulePdf and PlayoffsPdf"
```

---

## Task 15: Run all quality gates

- [ ] **Step 1: Run `/check`**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && npm run format:check && npm run test && npx tsc --noEmit
```

Expected: all gates GREEN.

- [ ] **Step 2: Fix any remaining issues**

If lint complains about unused imports or format issues, fix them. If tests fail, address them before continuing.

- [ ] **Step 3: Final commit (if any fixes were needed)**

```bash
git add -p
git commit -m "fix: address lint and format issues from /check"
```
