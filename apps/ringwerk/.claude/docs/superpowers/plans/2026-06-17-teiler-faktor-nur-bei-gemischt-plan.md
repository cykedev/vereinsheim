# Teiler-Faktor nur bei gemischter Disziplin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Disziplin-Korrekturfaktor (`teilerFaktor`) nur noch bei gemischter Disziplin (`Competition.disciplineId === null`) auf den Teiler anwenden; bei fester Disziplin ist der effektive Faktor 1,0.

**Architecture:** Eine zentrale reine Helper-Funktion `effectiveTeilerFaktor(competitionDisciplineId, faktor)` kodiert die Regel. Alle Berechnungspfade ziehen den Faktor durch diese Funktion: persistierende Actions (Liga/Event/Saison/Playoff), die reinen Ranking-Funktionen (über durchgereichten Kontext) und die Live-UI (über die Server-Pages). Der rohe `teilerFaktor` bleibt unverändert in DB/Query.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Prisma, Vitest.

## Required Docs

Baseline (immer): `code-conventions.md`, `reference-files.md`, `data-model.md`, `architecture.md`, `features.md`.
Zusätzlich:

- `ui-patterns.md` — für Task 8 (Änderungen an Server-Pages, die Props an Dialoge geben).

## Domänenregel (Referenz für alle Tasks)

- `Competition.disciplineId === null` → **gemischt** → Faktor-Korrektur **aktiv** (Teiler × Faktor).
- `Competition.disciplineId !== null` → **feste Disziplin** → Faktor-Korrektur **inaktiv** (effektiver Faktor = 1,0).

`MAX_RINGS` (results/playoffs): `{ WHOLE: 100, DECIMAL: 109 }` (fix). `getMaxRings` (series): `WHOLE = shotsPerSeries×10`, `DECIMAL = shotsPerSeries×10.9`.

---

### Task 1: Zentrale Helper-Funktion `effectiveTeilerFaktor`

**Files:**

- Modify: `src/lib/scoring/calculateScore.ts`
- Test: `src/lib/scoring/calculateScore.test.ts`

- [ ] **Step 1: Failing test** — am Ende von `src/lib/scoring/calculateScore.test.ts` einfügen, und den Import in Zeile 2 erweitern:

```ts
// Import in Zeile 2 erweitern:
import {
  calculateCorrectedTeiler,
  calculateRingteiler,
  calculateScore,
  effectiveTeilerFaktor,
} from "./calculateScore"

// Neuer describe-Block am Dateiende:
describe("effectiveTeilerFaktor", () => {
  it("feste Disziplin (disciplineId gesetzt) → Faktor 1.0", () => {
    expect(effectiveTeilerFaktor("disc-1", 0.3333333)).toBe(1)
    expect(effectiveTeilerFaktor("disc-1", 1.8)).toBe(1)
  })
  it("gemischte Disziplin (disciplineId null) → Faktor unverändert", () => {
    expect(effectiveTeilerFaktor(null, 0.3333333)).toBe(0.3333333)
    expect(effectiveTeilerFaktor(null, 1.0)).toBe(1.0)
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateScore.test.ts`
Expected: FAIL — `effectiveTeilerFaktor is not exported` / `is not a function`.

- [ ] **Step 3: Implementierung** — in `src/lib/scoring/calculateScore.ts` nach `calculateCorrectedTeiler` (nach Zeile 10) einfügen:

```ts
/**
 * Effektiver Teiler-Faktor: Die Faktor-Korrektur greift nur bei gemischter
 * Disziplin (Competition.disciplineId === null). Bei fester Disziplin ist der
 * effektive Faktor 1,0 (keine Korrektur).
 */
export function effectiveTeilerFaktor(
  competitionDisciplineId: string | null,
  faktor: number
): number {
  return competitionDisciplineId === null ? faktor : 1
}
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateScore.test.ts`
Expected: PASS (alle, inkl. bestehender).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/calculateScore.ts src/lib/scoring/calculateScore.test.ts
git commit -m "feat(scoring): add effectiveTeilerFaktor helper (factor only when mixed)"
```

---

### Task 2: Liga-Paarungen — `saveMatchResult`

**Files:**

- Modify: `src/lib/results/actions.ts:36-93`
- Test: `src/lib/results/actions.test.ts`

- [ ] **Step 1: Failing test** — in `src/lib/results/actions.test.ts` im `describe("saveMatchResult", …)`-Block ergänzen. Prüft, dass bei fester LP-Disziplin (Faktor 0,333) der gespeicherte Ringteiler **ohne** Faktor berechnet wird (`100 − 90 + 60×1 = 70`, nicht `100 − 90 + 60×0,333 = 30`):

```ts
it("feste Disziplin: Ringteiler ohne Faktor (LP 0.333 → effektiv 1.0)", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  const seriesUpsertMock = vi.fn().mockResolvedValue({})
  matchupFindUniqueMock.mockResolvedValue({
    ...matchupBase,
    competition: {
      shotsPerSeries: 10,
      discipline: { id: "d-lp", scoringType: "WHOLE", teilerFaktor: { toNumber: () => 0.3333333 } },
    },
    series: [],
  })
  transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      series: { upsert: seriesUpsertMock },
      matchup: { update: vi.fn().mockResolvedValue({}) },
    }
    return fn(tx)
  })
  await saveMatchResult("m1", {
    homeResult: { rings: 90, teiler: 60 },
    awayResult: { rings: 90, teiler: 60 },
  })
  const homeCall = seriesUpsertMock.mock.calls[0][0]
  expect(homeCall.create.ringteiler).toBe(70)
  expect(homeCall.update.ringteiler).toBe(70)
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/results/actions.test.ts`
Expected: FAIL — `expected 30 to be 70` (aktuell wird der Faktor angewendet).

- [ ] **Step 3: Implementierung** — in `src/lib/results/actions.ts`:

(a) Query um `disciplineId` der Competition erweitern. Im `select` des `competition`-Blocks (aktuell Zeilen 37-42) ergänzen:

```ts
      competition: {
        select: {
          shotsPerSeries: true,
          disciplineId: true,
          discipline: {
            select: { id: true, scoringType: true, teilerFaktor: true },
          },
        },
      },
```

(b) Faktor über `effectiveTeilerFaktor` ziehen. Import in Zeile 8 erweitern und Zeilen 77-78 ersetzen:

```ts
// Zeile 8:
import { calculateRingteiler, MAX_RINGS } from "./calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"

// Zeilen 77-78 ersetzen:
const competitionDisciplineId = matchup.competition.disciplineId
const homeFaktor = effectiveTeilerFaktor(
  competitionDisciplineId,
  homeDiscipline.teilerFaktor.toNumber()
)
const awayFaktor = effectiveTeilerFaktor(
  competitionDisciplineId,
  awayDiscipline.teilerFaktor.toNumber()
)
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/results/actions.test.ts`
Expected: PASS (alle).

- [ ] **Step 5: Commit**

```bash
git add src/lib/results/actions.ts src/lib/results/actions.test.ts
git commit -m "fix(results): apply teilerFaktor only for mixed discipline in saveMatchResult"
```

---

### Task 3: Event-Serien — `saveEventSeries`

**Files:**

- Modify: `src/lib/series/actions.ts:8, 127-128`
- Test: `src/lib/series/actions.test.ts`

- [ ] **Step 1: Failing test** — in `src/lib/series/actions.test.ts` im `describe("saveEventSeries", …)`-Block ergänzen. Festes Event, shotsPerSeries 10 → maxRings 100; LP-Faktor 0,333; rings 90, teiler 60 → erwartet `ringteiler = 70` (ohne Faktor):

```ts
it("feste Disziplin: Ringteiler ohne Faktor (LP 0.333 → effektiv 1.0)", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  const lpDiscipline = {
    id: "d-lp",
    name: "Luftpistole",
    scoringType: "WHOLE" as const,
    teilerFaktor: { toNumber: () => 0.3333333 },
  }
  competitionFindUniqueMock.mockResolvedValue({
    ...eventCompetition,
    shotsPerSeries: 10,
    disciplineId: "d-lp",
  })
  competitionParticipantFindUniqueMock.mockResolvedValue({
    id: "cp1",
    participantId: "p1",
    disciplineId: "d-lp",
    discipline: lpDiscipline,
    participant: { firstName: "Max", lastName: "Mustermann" },
  })
  await saveEventSeries("c1", "cp1", null, makeFormData({ rings: "90", teiler: "60" }))
  expect(seriesCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ ringteiler: 70 }) })
  )
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts`
Expected: FAIL — `ringteiler: 30` statt `70`.

- [ ] **Step 3: Implementierung** — in `src/lib/series/actions.ts`:

(a) Import ergänzen (Zeile 8 importiert aktuell aus calculateResult):

```ts
import { calculateRingteiler } from "@/lib/results/calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
```

(b) Zeilen 127-128 ersetzen:

```ts
const teilerFaktor = effectiveTeilerFaktor(
  competition.disciplineId,
  discipline.teilerFaktor.toNumber()
)
const ringteiler = calculateRingteiler(rings, teiler, teilerFaktor, maxRings)
```

Hinweis: `competition.disciplineId` ist in der `saveEventSeries`-Query bereits selektiert (Zeile 62).

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/series/actions.ts src/lib/series/actions.test.ts
git commit -m "fix(series): apply teilerFaktor only for mixed discipline in saveEventSeries"
```

---

### Task 4: Saison-Serien — `saveSeasonSeries` + `updateSeasonSeries`

**Files:**

- Modify: `src/lib/series/actions.ts:342-343, 480-481`
- Test: `src/lib/series/actions.test.ts`

Beide Funktionen lösen die Disziplin via `parsed.data.disciplineId ?? cp.disciplineId ?? competition.disciplineId` auf. Für die Faktor-Regel zählt allein `competition.disciplineId` (fest vs. gemischt). `competition.disciplineId` wird in beiden Funktionen bereits gelesen (Zeilen 305, 443) und ist damit selektiert.

- [ ] **Step 1: Failing test** — in `src/lib/series/actions.test.ts` im `describe("saveSeasonSeries", …)`-Block ergänzen (feste Saison-Disziplin). Falls der `describe`-Block fehlt, an passender Stelle neu anlegen, analog zum bestehenden Mock-Setup. Erwartet `ringteiler = 70`:

```ts
it("feste Saison-Disziplin: Ringteiler ohne Faktor", async () => {
  getAuthSessionMock.mockResolvedValue(adminSession)
  const lpDiscipline = {
    id: "d-lp",
    name: "Luftpistole",
    scoringType: "WHOLE" as const,
    teilerFaktor: { toNumber: () => 0.3333333 },
  }
  competitionFindUniqueMock.mockResolvedValue({
    ...seasonCompetition,
    shotsPerSeries: 10,
    disciplineId: "d-lp",
  })
  competitionParticipantFindFirstMock.mockResolvedValue({
    id: "cp1",
    disciplineId: "d-lp",
    discipline: lpDiscipline,
    participant: { firstName: "Max", lastName: "Mustermann" },
  })
  seriesFindUniqueMock.mockResolvedValue(null)
  await saveSeasonSeries(
    "c2",
    "p1",
    makeFormData({ rings: "90", teiler: "60", sessionDate: "2026-02-01" })
  )
  expect(seriesCreateMock).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ ringteiler: 70 }) })
  )
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts`
Expected: FAIL — `ringteiler: 30` statt `70`. (Falls das Mock-Setup für `saveSeasonSeries` abweicht — z.B. anderer Speicherpfad — den Mock an den real verwendeten Speicheraufruf anpassen; verifiziere durch erneuten Lauf, dass der Test aus dem richtigen Grund fehlschlägt.)

- [ ] **Step 3: Implementierung** — in `src/lib/series/actions.ts` an **beiden** Stellen (Zeilen 342-343 in `saveSeasonSeries` und 480-481 in `updateSeasonSeries`) identisch ersetzen:

```ts
const teilerFaktor = effectiveTeilerFaktor(
  competition.disciplineId,
  discipline.teilerFaktor.toNumber()
)
const ringteiler = calculateRingteiler(rings, teiler, teilerFaktor, maxRings)
```

(Der Import aus Task 3 deckt beide Stellen ab.)

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/series/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/series/actions.ts src/lib/series/actions.test.ts
git commit -m "fix(series): apply teilerFaktor only for mixed discipline in season series"
```

---

### Task 5: Playoff-Duelle — `savePlayoffDuelResult`

**Files:**

- Modify: `src/lib/playoffs/actions/duel.ts:7, 62/141-148, 159-170`

**Test-Hinweis:** Es gibt keinen bestehenden Action-Test für `savePlayoffDuelResult`; das Mock-Setup (Duel-Query mit verschachteltem `playoffMatch.competition`, Finale-Logik, Win-Berechnung) wäre für einen 1-Zeilen-Faktorwechsel unverhältnismäßig. Die Kernregel ist durch den `effectiveTeilerFaktor`-Unit-Test (Task 1) und `tsc` abgedeckt. **Bewusste YAGNI-Entscheidung: kein dedizierter Action-Test hier.**

- [ ] **Step 1: Import ergänzen** — in `src/lib/playoffs/actions/duel.ts` (Zeile 7 importiert aus calculateResult):

```ts
import { calculateRingteiler, MAX_RINGS } from "@/lib/results/calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
```

- [ ] **Step 2: `competition.disciplineId` verfügbar machen** — sicherstellen, dass die Duel-Query `duel.playoffMatch.competition.disciplineId` selektiert. Im `select` des `competition`-Blocks der `playoffDuel.findUnique`-Query (um Zeile 62) `disciplineId: true` ergänzen, falls nicht vorhanden:

```ts
              competition: {
                select: {
                  disciplineId: true,
                  scoringMode: true,
                  discipline: { select: { scoringType: true, teilerFaktor: true } },
                  // … bestehende Felder beibehalten
                },
              },
```

- [ ] **Step 3: Faktor über `effectiveTeilerFaktor`** — Zeilen 159-170 ersetzen:

```ts
const competitionDisciplineId = duel.playoffMatch.competition.disciplineId
ringteilerA = calculateRingteiler(
  input.totalRingsA,
  input.teilerA ?? 0,
  effectiveTeilerFaktor(competitionDisciplineId, disciplineA.teilerFaktor.toNumber()),
  maxRingsA
)
ringteilerB = calculateRingteiler(
  input.totalRingsB,
  input.teilerB ?? 0,
  effectiveTeilerFaktor(competitionDisciplineId, disciplineB.teilerFaktor.toNumber()),
  maxRingsB
)
```

- [ ] **Step 4: Typecheck + bestehende Playoff-Tests**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit && docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/playoffs/`
Expected: PASS (keine Typfehler; bestehende Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/lib/playoffs/actions/duel.ts
git commit -m "fix(playoffs): apply teilerFaktor only for mixed discipline in duel results"
```

---

### Task 6: Event-Rangliste — `rankEventParticipants` (on-the-fly)

**Files:**

- Modify: `src/lib/scoring/rankEventParticipants.ts:37-46, 60`
- Modify (Aufrufer): `src/app/(app)/page.tsx:47`, `src/app/(app)/competitions/[id]/ranking/page.tsx:38`, `src/app/api/competitions/[id]/pdf/ranking/route.ts:27`, `src/app/api/public/c/[slug]/pdf/route.ts:152`
- Test: `src/lib/scoring/rankEventParticipants.test.ts`

- [ ] **Step 1: Failing test** — in `src/lib/scoring/rankEventParticipants.test.ts`. Zuerst `BASE_CONFIG` (Zeile 39-44) um das neue Pflichtfeld ergänzen (Default = gemischt, erhält bestehendes Verhalten):

```ts
const BASE_CONFIG = {
  scoringMode: "RINGTEILER" as const,
  targetValue: null,
  targetValueType: null,
  discipline: { scoringType: "WHOLE" as const },
  competitionDisciplineId: null,
}
```

Dann neuen Test ergänzen (festes Event → kein Faktor; TEILER-Modus macht den korrigierten Teiler direkt zum Score):

```ts
describe("rankEventParticipants – Faktor nur bei gemischt", () => {
  const lpSeries = (id: string, teiler: number) =>
    makeSeries({
      participantId: id,
      rings: 90,
      teiler,
      discipline: { name: "LP", teilerFaktor: 0.3333333, scoringType: "WHOLE" as const },
    })

  it("festes Event (disciplineId gesetzt): correctedTeiler OHNE Faktor", () => {
    const result = rankEventParticipants([lpSeries("A", 60)], {
      ...BASE_CONFIG,
      scoringMode: "TEILER",
      competitionDisciplineId: "d-lp",
    })
    expect(result[0].correctedTeiler).toBeCloseTo(60) // 60 × 1, nicht 60 × 0.333 = 20
    expect(result[0].score).toBeCloseTo(60)
  })

  it("gemischtes Event (disciplineId null): correctedTeiler MIT Faktor", () => {
    const result = rankEventParticipants([lpSeries("A", 60)], {
      ...BASE_CONFIG,
      scoringMode: "TEILER",
      competitionDisciplineId: null,
    })
    expect(result[0].correctedTeiler).toBeCloseTo(20) // 60 × 0.333
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/rankEventParticipants.test.ts`
Expected: FAIL — `correctedTeiler` ist 20 statt 60 im festen Fall (Faktor wird noch angewandt). (TS-Fehler zum Feld erst nach Step 3 behoben — Vitest läuft dennoch und zeigt den Assertion-Fehlschlag.)

- [ ] **Step 3: Implementierung**

(a) `EventConfig` (Zeilen 37-46) um Pflichtfeld erweitern:

```ts
type EventConfig = {
  scoringMode: ScoringMode
  targetValue: number | null
  targetValueType: TargetValueType | null
  /** Competition.disciplineId — null = gemischt (Faktor aktiv), sonst feste Disziplin (Faktor 1.0). */
  competitionDisciplineId: string | null
  /**
   * @deprecated No longer used for maxRings calculation …
   */
  discipline: { scoringType: ScoringType } | null
}
```

(b) Import (Zeile 3) und Faktor-Zeile (Zeile 60) anpassen:

```ts
// Zeile 3:
import { calculateScore, calculateCorrectedTeiler, effectiveTeilerFaktor } from "./calculateScore"

// Zeile 60:
const faktor = effectiveTeilerFaktor(config.competitionDisciplineId, s.discipline.teilerFaktor)
```

(c) Alle 4 Aufrufer um `competitionDisciplineId: competition.disciplineId` im Config-Objekt erweitern. In jeder Datei steht die `competition` (bzw. `data.competition`) zur Verfügung:

- `src/app/(app)/page.tsx:47` — `rankEventParticipants(data.series, { … , competitionDisciplineId: data.competition.disciplineId })`
- `src/app/(app)/competitions/[id]/ranking/page.tsx:38` (Config wird als `eventConfig` gebaut — Feld dort ergänzen, `competition.disciplineId`)
- `src/app/api/competitions/[id]/pdf/ranking/route.ts:27` — `competitionDisciplineId: data.competition.disciplineId`
- `src/app/api/public/c/[slug]/pdf/route.ts:152` — `competitionDisciplineId: data.competition.disciplineId`

- [ ] **Step 4: Test + Typecheck verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/rankEventParticipants.test.ts && docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit`
Expected: PASS und keine Typfehler (tsc erzwingt, dass alle 4 Aufrufer das Pflichtfeld setzen).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/rankEventParticipants.ts src/lib/scoring/rankEventParticipants.test.ts "src/app/(app)/page.tsx" "src/app/(app)/competitions/[id]/ranking/page.tsx" "src/app/api/competitions/[id]/pdf/ranking/route.ts" "src/app/api/public/c/[slug]/pdf/route.ts"
git commit -m "fix(scoring): rankEventParticipants applies teilerFaktor only for mixed discipline"
```

---

### Task 7: Saison-Tabelle — `calculateSeasonStandings` (on-the-fly)

**Files:**

- Modify: `src/lib/scoring/calculateSeasonStandings.ts:36-39, 74`
- Modify (Aufrufer): `src/app/(app)/page.tsx:64`, `src/app/(app)/competitions/[id]/standings/page.tsx:30`, `src/app/api/competitions/[id]/pdf/standings/route.ts:27`, `src/app/api/public/c/[slug]/pdf/route.ts:185`
- Test: `src/lib/scoring/calculateSeasonStandings.test.ts`

- [ ] **Step 1: Failing test** — in `src/lib/scoring/calculateSeasonStandings.test.ts` ergänzen. `bestCorrectedTeiler` bei fester Disziplin ohne Faktor:

```ts
describe("calculateSeasonStandings – Faktor nur bei gemischt", () => {
  const lp = (teiler: number) =>
    makeSeries("p1", {
      rings: 90,
      teiler,
      ringteiler: 30,
      discipline: { name: "LP", teilerFaktor: 0.3333333, scoringType: "WHOLE" as const },
    })

  it("feste Saison-Disziplin: bestCorrectedTeiler OHNE Faktor", () => {
    const result = calculateSeasonStandings(
      [{ participantId: "p1", participantName: "Müller, Max", series: [lp(60)] }],
      null,
      "d-lp"
    )
    expect(result[0].bestCorrectedTeiler).toBeCloseTo(60) // 60 × 1, nicht 20
  })

  it("gemischte Saison (disciplineId null): bestCorrectedTeiler MIT Faktor", () => {
    const result = calculateSeasonStandings(
      [{ participantId: "p1", participantName: "Müller, Max", series: [lp(60)] }],
      null,
      null
    )
    expect(result[0].bestCorrectedTeiler).toBeCloseTo(20) // 60 × 0.333
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateSeasonStandings.test.ts`
Expected: FAIL — `bestCorrectedTeiler` ist 20 statt 60 im festen Fall.

- [ ] **Step 3: Implementierung**

(a) Import oben in `src/lib/scoring/calculateSeasonStandings.ts` (Zeile 1) erweitern und Signatur (Zeilen 36-39) um optionalen Kontext erweitern (Default `null` = gemischt, erhält bestehendes Verhalten für vorhandene Tests):

```ts
// Zeile 1:
import { calculateCorrectedTeiler, effectiveTeilerFaktor } from "./calculateScore"

// Signatur:
export function calculateSeasonStandings(
  participants: ParticipantInput[],
  minSeries: number | null,
  competitionDisciplineId: string | null = null
): SeasonStandingsEntry[] {
```

(b) Zeile 74 (`bestCorrectedTeiler`) anpassen:

```ts
const bestCorrectedTeiler = Math.min(
  ...p.series.map((s) =>
    calculateCorrectedTeiler(
      s.teiler,
      effectiveTeilerFaktor(competitionDisciplineId, s.discipline.teilerFaktor)
    )
  )
)
```

(c) Alle 4 Aufrufer um das 3. Argument `competition.disciplineId` erweitern:

- `src/app/(app)/page.tsx:64` — `calculateSeasonStandings(data.participants.map(…), minSeries, data.competition.disciplineId)`
- `src/app/(app)/competitions/[id]/standings/page.tsx:30` — 3. Arg `competition.disciplineId`
- `src/app/api/competitions/[id]/pdf/standings/route.ts:27` — 3. Arg `data.competition.disciplineId`
- `src/app/api/public/c/[slug]/pdf/route.ts:185` — 3. Arg `data.competition.disciplineId`

- [ ] **Step 4: Verifikation, dass alle 4 Aufrufer den Param setzen** (Default-Param wird von tsc nicht erzwungen):

Run: `grep -rn "calculateSeasonStandings(" src/app`
Expected: 4 Treffer; jeder Aufruf übergibt sichtbar `…disciplineId` als 3. Argument. Außerdem `docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/calculateSeasonStandings.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/calculateSeasonStandings.ts src/lib/scoring/calculateSeasonStandings.test.ts "src/app/(app)/page.tsx" "src/app/(app)/competitions/[id]/standings/page.tsx" "src/app/api/competitions/[id]/pdf/standings/route.ts" "src/app/api/public/c/[slug]/pdf/route.ts"
git commit -m "fix(scoring): calculateSeasonStandings applies teilerFaktor only for mixed discipline"
```

---

### Task 8: Live-UI — „korr. Teiler"-Hint bei fester Disziplin unterdrücken

**Files:**

- Modify: `src/app/(app)/competitions/[id]/schedule/page.tsx:99`
- Modify: `src/app/(app)/competitions/[id]/series/page.tsx:161`

Die Dialoge zeigen den Hint nur bei `teilerFaktor !== 1`. Erhalten sie bei fester Disziplin `1`, verschwindet er. Es wird also der effektive Faktor an die Props übergeben.

- [ ] **Step 1: `schedule/page.tsx` anpassen** — Import von `effectiveTeilerFaktor` ergänzen und Zeile 99 ersetzen:

```ts
// Zeile 99 (vorher: competitionTeilerFaktor={competition.discipline?.teilerFaktor ?? 1}):
competitionTeilerFaktor={effectiveTeilerFaktor(competition.disciplineId, competition.discipline?.teilerFaktor ?? 1)}
```

- [ ] **Step 2: `series/page.tsx` anpassen** — Import von `effectiveTeilerFaktor` ergänzen und Zeile 161 ersetzen:

```ts
// Zeile 161 (vorher: teilerFaktor={(cp.discipline ?? competition.discipline)?.teilerFaktor ?? 1}):
teilerFaktor={effectiveTeilerFaktor(competition.disciplineId, (cp.discipline ?? competition.discipline)?.teilerFaktor ?? 1)}
```

(Bei gemischtem Wettbewerb ist `competition.disciplineId === null`, sodass der per-Teilnehmer-Faktor erhalten bleibt.)

- [ ] **Step 3: Typecheck**

Run: `docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Preview-Verifikation** — Dev-Server starten, eine Liga mit fester LP-Disziplin öffnen, Ergebnis-Eingabedialog öffnen, Teiler eingeben: Der „korr. Teiler"-Hint darf **nicht** erscheinen. In einem gemischten Event muss er weiterhin erscheinen. (preview_start → preview_click/preview_fill → preview_snapshot.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/competitions/[id]/schedule/page.tsx" "src/app/(app)/competitions/[id]/series/page.tsx"
git commit -m "fix(ui): hide corrected-teiler hint for fixed discipline"
```

---

### Task 9: Seed-Konsistenz prüfen + finaler `/check`

**Files:**

- Inspect: `prisma/seed.ts` (bzw. Seed-Quelle)

- [ ] **Step 1: Seed prüfen** — Seed-Datei daraufhin lesen, ob Ringteiler-Werte für Liga/Event/Saison über die Action-/Calculate-Logik erzeugt werden (dann nach dem Fix automatisch korrekt) oder hart kodiert sind. Bei hart kodierten Werten für **feste** Disziplinen: Werte auf die faktorfreie Berechnung umstellen. Bei gemischten Disziplinen: unverändert lassen.

- [ ] **Step 2: Falls Seed angepasst — Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(seed): consistent ringteiler for fixed disciplines"
```

(Falls keine Anpassung nötig: diesen Step überspringen und im Abschluss vermerken.)

- [ ] **Step 3: Vollständiger Quality-Gate**

Run: `/check` (lint, format:check, test, tsc) via `docker compose -f docker-compose.dev.yml run --rm app`.
Expected: alle Gates grün.

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Coverage:**

- Helper-Funktion → Task 1 ✓
- Persistierende Actions (results, series×3, playoffs) → Tasks 2, 3, 4, 5 ✓
- On-the-fly (rankEventParticipants, calculateSeasonStandings) → Tasks 6, 7 ✓
- Live-UI → Task 8 ✓
- Kein Recompute (Seed-Daten) → kein Task; Seed-Konsistenz in Task 9 ✓
- Saison-Sonderfall: **verifiziert — Saison kann feste Disziplin haben** (create.ts setzt disciplineId typ-unabhängig), daher in Tasks 4 + 7 voll behandelt (korrigiert die Spec-Annahme).

**Type-Konsistenz:** `effectiveTeilerFaktor(competitionDisciplineId: string | null, faktor: number)` einheitlich in allen Tasks. `EventConfig.competitionDisciplineId` (Pflicht) und `calculateSeasonStandings(..., competitionDisciplineId = null)` (Default) — bewusst unterschiedlich wegen Aufrufmuster (Config-Objekt vs. Positionsargumente), in Task 6/7 dokumentiert.

**Platzhalter:** keine; jeder Code-Step zeigt vollständigen Code, jeder Run-Step das erwartete Ergebnis.
