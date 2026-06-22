# Liga-Modus „Best-of-Begegnung" (BEST_OF_SINGLE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an alternative LEAGUE format `BEST_OF_SINGLE` — single round-robin where each pairing is a Best-of-N (default Best-of-3, all duels played) decided by the league `scoringMode`, with a Stechschuss (single decimal-scored shot, repeated) resolving a level match; the table ranks by match-wins.

**Architecture:** `Matchup` stays the pairing/schedule slot; each duel is a pair of `Series` rows (`duelNumber`), each Stechschuss a `Series` with `isTiebreak`. The best-of resolution is a pure module `lib/scoring/bestOf.ts` shared in spirit with the playoffs. Standings get a second, focused calculator. The classic `DOUBLE_ROUND_ROBIN` path is untouched.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 7 (PostgreSQL), TypeScript strict, Vitest, react-pdf, shadcn/ui, Tailwind.

**Spec:** `.claude/docs/superpowers/specs/2026-06-17-liga-best-of-modus-design.md` (read it before starting).

---

## ⚠️ Worktree & Checks (read first)

This branch is developed in a git **worktree** (`.claude/worktrees/feat+liga-best-of-modus`). The project's `/check` runs through `docker compose`, which mounts the **main** repo — it does **not** see worktree changes. Therefore:

- **Do NOT run `/check`.** Run the gates directly via npm from the worktree root:
  - `npm run lint`
  - `npm run format:check`
  - `npm run test` (Vitest; or a single file: `npx vitest run path/to/file.test.ts`)
  - `npx tsc --noEmit`
- `node_modules` and `src/generated/prisma/` are set up in the worktree (`npm install` + `npx prisma generate`). After any `schema.prisma` change, re-run `npx prisma generate`.
- **Migrations need a database.** Do **not** apply migrations against the shared dev DB (would disturb the parallel teiler-faktor work in `main`). In the worktree, only **author the migration SQL file** (Task 1.3). Applying the migration + any real-DB verification happens at **integration into `main`** (where docker works). All tests in this plan are pure/unit or mock the DB — they run via npm without a live database.
- Commit per task (subagents commit after each task). No `Co-Authored-By`. Never commit to `main`.

## Required Docs

Subagents read these **before writing code** (baseline per CLAUDE.md): `code-conventions.md`, `reference-files.md`, `data-model.md`, `architecture.md`, `features.md`, and `ui-patterns.md` (for any `.tsx`). Task-specific:

- **`technical.md`** — Prisma 7 / migration conventions (Tasks 1.x).
- **`worktrees.md`** — why `/check` is replaced by npm gates here.
- The **spec** (above) — authoritative for rules; this plan implements it.

---

## File Structure

**Create:**

- `src/lib/scoring/bestOf.ts` (+ `.test.ts`) — pure best-of resolution (`resolveBestOf`, duel/match status).
- `src/lib/standings/calculateBestOfStandings.ts` (+ `.test.ts`) — match-win standings + sort chain.
- `src/lib/matchups/generateBestOfSchedule.ts` (+ `.test.ts`) — single round-robin (one leg of circle method).
- `src/components/app/matchups/BestOfMatchCard.tsx` — duel-by-duel + Stechschuss entry UI.
- `src/components/app/standings/BestOfStandingsTable.tsx` — best-of table view.
- `src/lib/pdf/SchedulePdf.bestof.tsx` (or a variant inside `SchedulePdf.tsx`) — best-of schedule+table PDF.
- Prisma migration folder under `prisma/migrations/<timestamp>_best_of_single/`.

**Modify:**

- `prisma/schema.prisma` — enum + Competition/Series fields + Series unique index.
- `src/lib/scoring/types.ts` — duel/best-of types.
- `src/lib/competitions/{actions,types}.ts` — create/edit fields + validation; lock after schedule gen.
- `src/lib/matchups/actions.ts` — schedule generation format switch.
- `src/lib/results/actions.ts` (or new `src/lib/results/bestOfActions.ts`) — duel + Stechschuss recording, audit.
- `src/lib/standings/queries.ts` — load best-of standings data.
- `src/components/app/competitions/CompetitionForm.tsx` — format toggle, groupBestOf, groupPlayAllDuels, scoringMode restriction, optional tiebreakers, sudden-death.
- `src/components/app/matchups/ScheduleView.tsx` and the standings page — format switch.
- Docs in `.claude/docs/`.

---

## Phase 1 — Schema & Migration

### Task 1.1: Add enum + Competition + Series fields

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add `LeagueFormat` enum** near the other enums:

```prisma
enum LeagueFormat {
  DOUBLE_ROUND_ROBIN
  BEST_OF_SINGLE
}
```

- [ ] **Step 2: Add fields to `model Competition`** (in the Liga-specific block):

```prisma
  leagueFormat        LeagueFormat @default(DOUBLE_ROUND_ROBIN)
  // N in Best-of-N (odd). Default 3 = Best-of-3. Wins needed = ceil(N/2).
  groupBestOf         Int?         @default(3)
  // Always play all N duels (no early stop). Recommended standard for BEST_OF_SINGLE.
  groupPlayAllDuels   Boolean      @default(false)
  // Optional override: secondary criteria to break a duel value-tie instead of Stechschuss.
  groupTiebreaker1    ScoringMode?
  groupTiebreaker2    ScoringMode?
  // Match-level tie resolution: true = Stechschuss (standard), false = replay duel.
  groupHasSuddenDeath Boolean      @default(true)
```

- [ ] **Step 3: Add fields to `model Series`** and change the unique index:

```prisma
  // Liga BEST_OF_SINGLE: 1..N duel number; Stechschuss rounds continue past N. Else 1; Event/Saison: null.
  duelNumber Int?
  // Stechschuss shot (single decimal-scored shot). shots/teiler unused; value in `rings`.
  isTiebreak Boolean @default(false)
```

Replace `@@unique([matchupId, participantId])` with:

```prisma
  @@unique([matchupId, participantId, duelNumber])
```

- [ ] **Step 4: Regenerate the client and typecheck.**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: client regenerates; `tsc` passes (no usages broken yet).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add BEST_OF_SINGLE league format + duel/tiebreak fields"
```

### Task 1.2: Backfill plan for existing Liga series

**Note (no code):** Existing `DOUBLE_ROUND_ROBIN` series must get `duelNumber = 1` so the new unique index holds. This is captured in the migration SQL (Task 1.3) as an `UPDATE`. Pre-launch → effectively no rows, but the statement must be present for correctness.

### Task 1.3: Author the migration SQL

**Files:** Create `prisma/migrations/<timestamp>_best_of_single/migration.sql`

- [ ] **Step 1: Generate the SQL via diff (no app DB applied).** Prefer:

Run: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` is **not** correct here (same source/target). Instead author the file by hand from the schema delta, or generate against a throwaway DB later at integration. Hand-authored SQL:

```sql
-- CreateEnum
CREATE TYPE "LeagueFormat" AS ENUM ('DOUBLE_ROUND_ROBIN', 'BEST_OF_SINGLE');

-- AlterTable Competition
ALTER TABLE "Competition"
  ADD COLUMN "leagueFormat" "LeagueFormat" NOT NULL DEFAULT 'DOUBLE_ROUND_ROBIN',
  ADD COLUMN "groupBestOf" INTEGER DEFAULT 3,
  ADD COLUMN "groupPlayAllDuels" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "groupTiebreaker1" "ScoringMode",
  ADD COLUMN "groupTiebreaker2" "ScoringMode",
  ADD COLUMN "groupHasSuddenDeath" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Series
ALTER TABLE "Series"
  ADD COLUMN "duelNumber" INTEGER,
  ADD COLUMN "isTiebreak" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing liga series (matchup-bound) to duelNumber = 1
UPDATE "Series" SET "duelNumber" = 1 WHERE "matchupId" IS NOT NULL AND "duelNumber" IS NULL;

-- Swap unique index
DROP INDEX IF EXISTS "Series_matchupId_participantId_key";
CREATE UNIQUE INDEX "Series_matchupId_participantId_duelNumber_key"
  ON "Series" ("matchupId", "participantId", "duelNumber");
```

> The exact `DROP INDEX` name must match the existing one — confirm with `\d "Series"` against a DB at integration time and adjust. NULL `duelNumber` rows (Event/Saison) remain distinct under SQL NULL semantics.

- [ ] **Step 2: Commit** (migration applied/verified at integration into `main`):

```bash
git add prisma/migrations
git commit -m "feat(migration): best_of_single columns + Series duel unique index"
```

---

## Phase 2 — Shared Best-of resolution (pure)

### Task 2.1: Best-of types + `resolveBestOf`

**Files:** Create `src/lib/scoring/bestOf.ts`, `src/lib/scoring/bestOf.test.ts`

**Semantics (authoritative):**

- A _duel_ outcome is `"A" | "B" | "TIE"`. `"TIE"` = both series equal on the league `scoringMode` (and the optional secondary chain). TIE counts for neither side.
- `requiredWins = ceil(bestOf / 2)`.
- The match plays **at most `bestOf` duels**:
  - `playAll = true` (standard): always play all `bestOf` duels.
  - `playAll = false`: stop early once a side reaches `requiredWins`.
- After the duels: most wins → winner. **Level at `bestOf` duels** (only possible via TIEs) → needs Stechschuss.
- _Stechschuss_ rounds are also `"A" | "B" | "TIE"` (single decimal shot each; TIE = shoot again). First non-TIE round decides; while empty or TIE → still needs Stechschuss.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest"
import { resolveBestOf } from "./bestOf"

const opts = (o: Partial<{ bestOf: number; playAll: boolean }> = {}) => ({
  bestOf: 3,
  playAll: true,
  ...o,
})

describe("resolveBestOf", () => {
  it("playAll: A wins all three -> complete A after 3 duels", () => {
    expect(resolveBestOf(["A", "A", "A"], [], opts())).toEqual({ kind: "complete", winner: "A" })
  })
  it("playAll: still needs duels until N are played even when clinched", () => {
    expect(resolveBestOf(["A", "A"], [], opts())).toEqual({ kind: "in_progress" })
  })
  it("playAll: 2:1 after three -> complete A", () => {
    expect(resolveBestOf(["A", "B", "A"], [], opts())).toEqual({ kind: "complete", winner: "A" })
  })
  it("early end: 2:0 stops before third duel", () => {
    expect(resolveBestOf(["A", "A"], [], opts({ playAll: false }))).toEqual({
      kind: "complete",
      winner: "A",
    })
  })
  it("level after N (one TIE) -> needs_tiebreak", () => {
    expect(resolveBestOf(["A", "B", "TIE"], [], opts())).toEqual({ kind: "needs_tiebreak" })
  })
  it("level after N, Stechschuss decides B", () => {
    expect(resolveBestOf(["A", "B", "TIE"], ["B"], opts())).toEqual({
      kind: "complete",
      winner: "B",
    })
  })
  it("Stechschuss tie repeats", () => {
    expect(resolveBestOf(["TIE", "TIE", "TIE"], ["TIE"], opts())).toEqual({
      kind: "needs_tiebreak",
    })
  })
  it("best-of-5 early end at 3 wins", () => {
    expect(resolveBestOf(["A", "B", "A", "A"], [], opts({ bestOf: 5, playAll: false }))).toEqual({
      kind: "complete",
      winner: "A",
    })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/scoring/bestOf.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type DuelOutcome = "A" | "B" | "TIE"

export type BestOfStatus =
  | { kind: "in_progress" }
  | { kind: "needs_tiebreak" }
  | { kind: "complete"; winner: "A" | "B" }

export interface ResolveBestOfOptions {
  /** N in Best-of-N (odd). */
  bestOf: number
  /** Standard: play all N duels regardless of an early clinch. */
  playAll: boolean
}

function count(outcomes: DuelOutcome[]): { a: number; b: number } {
  return {
    a: outcomes.filter((o) => o === "A").length,
    b: outcomes.filter((o) => o === "B").length,
  }
}

export function resolveBestOf(
  duels: DuelOutcome[],
  tiebreaks: DuelOutcome[],
  opts: ResolveBestOfOptions
): BestOfStatus {
  const requiredWins = Math.ceil(opts.bestOf / 2)
  const { a, b } = count(duels)

  // Early end: a clinch finishes the match immediately.
  if (!opts.playAll && (a >= requiredWins || b >= requiredWins)) {
    return { kind: "complete", winner: a > b ? "A" : "B" }
  }

  // Not yet all duels played → keep going.
  if (duels.length < opts.bestOf) return { kind: "in_progress" }

  // All N duels played.
  if (a > b) return { kind: "complete", winner: "A" }
  if (b > a) return { kind: "complete", winner: "B" }

  // Level → Stechschuss.
  const decided = tiebreaks.find((t) => t !== "TIE")
  if (decided) return { kind: "complete", winner: decided }
  return { kind: "needs_tiebreak" }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/scoring/bestOf.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/bestOf.ts src/lib/scoring/bestOf.test.ts
git commit -m "feat(scoring): pure resolveBestOf (duels + Stechschuss)"
```

### Task 2.2: Duel outcome from two series (`duelOutcome`)

**Files:** Modify `src/lib/scoring/bestOf.ts`, `src/lib/scoring/bestOf.test.ts`

**Semantics:** Decide a single duel from two series using the league `scoringMode`. Equal value → `"TIE"` (standard) **unless** optional secondary criteria (`tiebreaker1/2`) break it. Reuse `determineOutcome` from `src/lib/results/calculateResult.ts` for the per-mode comparison, but map its tiebreak so that a pure value-tie returns `"TIE"` (not a forced winner). Plan: implement a small comparator that (a) compares by the primary mode value only, (b) if equal and `tiebreaker1` set, compares by that mode, then `tiebreaker2`, (c) else `"TIE"`.

- [ ] **Step 1: Write failing tests** (cover RINGTEILER equal value → TIE; RINGS higher rings → A; optional tiebreaker breaks a tie):

```ts
import { duelOutcome } from "./bestOf"

const s = (rings: number, teiler: number, ringteiler: number) => ({ rings, teiler, ringteiler })

describe("duelOutcome", () => {
  it("RINGTEILER: lower wins", () => {
    expect(duelOutcome(s(96, 3.7, 7.7), s(95, 2.0, 7.0), "RINGTEILER", null, null)).toBe("B")
  })
  it("RINGTEILER: equal ringteiler from different rings -> TIE (standard)", () => {
    expect(duelOutcome(s(96, 3.7, 7.7), s(95, 2.7, 7.7), "RINGTEILER", null, null)).toBe("TIE")
  })
  it("RINGTEILER: optional tiebreaker RINGS breaks the tie -> A (more rings)", () => {
    expect(duelOutcome(s(96, 3.7, 7.7), s(95, 2.7, 7.7), "RINGTEILER", "RINGS", null)).toBe("A")
  })
  it("RINGS: higher rings wins", () => {
    expect(duelOutcome(s(96, 9, 0), s(95, 1, 0), "RINGS", null, null)).toBe("A")
  })
  it("RINGS: equal rings -> TIE without tiebreaker", () => {
    expect(duelOutcome(s(95, 1, 0), s(95, 9, 0), "RINGS", null, null)).toBe("TIE")
  })
})
```

- [ ] **Step 2: Run → FAIL.** `npx vitest run src/lib/scoring/bestOf.test.ts`

- [ ] **Step 3: Implement `duelOutcome`** (add to `bestOf.ts`):

```ts
import type { ScoringMode } from "@/generated/prisma/client"

export interface DuelSeries {
  rings: number
  teiler: number
  ringteiler: number
}

function compareByMode(a: DuelSeries, b: DuelSeries, mode: ScoringMode): -1 | 0 | 1 {
  // returns -1 if A better, 1 if B better, 0 if equal on this mode
  if (mode === "RINGS" || mode === "RINGS_DECIMAL") {
    if (a.rings > b.rings) return -1
    if (a.rings < b.rings) return 1
    return 0
  }
  if (mode === "TEILER") {
    if (a.teiler < b.teiler) return -1
    if (a.teiler > b.teiler) return 1
    return 0
  }
  // RINGTEILER (and fallback)
  if (a.ringteiler < b.ringteiler) return -1
  if (a.ringteiler > b.ringteiler) return 1
  return 0
}

export function duelOutcome(
  a: DuelSeries,
  b: DuelSeries,
  mode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null
): DuelOutcome {
  for (const m of [mode, tiebreaker1, tiebreaker2]) {
    if (!m) continue
    const c = compareByMode(a, b, m)
    if (c !== 0) return c < 0 ? "A" : "B"
  }
  return "TIE"
}
```

- [ ] **Step 4: Run → PASS.** `npx vitest run src/lib/scoring/bestOf.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring/bestOf.ts src/lib/scoring/bestOf.test.ts
git commit -m "feat(scoring): duelOutcome with optional secondary criteria + TIE"
```

---

## Phase 3 — Single round-robin schedule (pure)

### Task 3.1: `generateBestOfSchedule`

**Files:** Create `src/lib/matchups/generateBestOfSchedule.ts`, `.test.ts`. Read existing `src/lib/matchups/generateSchedule.ts` first and reuse its circle-method helper for **one leg only** (no return leg).

**Semantics:** Input participant ids (≥4). Output one round-robin leg: each unordered pair exactly once, grouped into Spieltage (`roundIndex` 1..). Odd count → one rotating BYE per Spieltag (a slot with `awayParticipantId = null`), each participant resting exactly once; BYE carries **no** win/points.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest"
import { generateBestOfSchedule } from "./generateBestOfSchedule"

describe("generateBestOfSchedule", () => {
  it("4 players: 6 pairings, every pair once, no byes", () => {
    const s = generateBestOfSchedule(["a", "b", "c", "d"])
    const pairs = s
      .filter((m) => m.awayId)
      .map((m) => [m.homeId, m.awayId].sort().join("-"))
      .sort()
    expect(pairs).toEqual(["a-b", "a-c", "a-d", "b-c", "b-d", "c-d"])
    expect(s.some((m) => m.awayId === null)).toBe(false)
  })
  it("5 players: 10 pairings, each player exactly one bye", () => {
    const ids = ["a", "b", "c", "d", "e"]
    const s = generateBestOfSchedule(ids)
    expect(s.filter((m) => m.awayId).length).toBe(10)
    for (const id of ids) {
      const byes = s.filter((m) => m.awayId === null && m.homeId === id).length
      expect(byes).toBe(1)
    }
  })
})
```

- [ ] **Step 2: Run → FAIL.** `npx vitest run src/lib/matchups/generateBestOfSchedule.test.ts`

- [ ] **Step 3: Implement** (circle method, single leg). Return shape `{ homeId: string; awayId: string | null; roundIndex: number }[]`. Mirror the existing generator's rotation; emit only the first leg. (Full code: adapt `generateSchedule.ts`'s leg construction — keep one leg, drop the mirrored return leg.)

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit** `feat(matchups): single round-robin generator for best-of`.

---

## Phase 4 — Best-of standings (pure)

### Task 4.1: `calculateBestOfStandings`

**Files:** Create `src/lib/standings/calculateBestOfStandings.ts`, `.test.ts`. Read `src/lib/standings/calculateStandings.ts` for the row shape, withdrawal handling, and the direct-comparison helper to mirror.

**Semantics:** Input participants + matchups, where each matchup carries its `Series` (regular duels by `duelNumber` + Stechschuss `isTiebreak`). Per matchup: group regular duels, compute each duel via `duelOutcome`, resolve via `resolveBestOf` (+ Stechschuss series) → match winner. Exclude matchups with a withdrawn participant. Row: `played, wins, losses, duelsWon, duelsLost, duelDiff, bestRingteiler, bestRings` (Stechschuss series **excluded** from best-result). Sort: **wins desc → direct comparison (match-wins within the tied group) → duelDiff desc → best single result (mode-aware) → lastName**. Withdrawn rows to the bottom.

- [ ] **Step 1: Write failing tests** — minimum cases: (a) clean ranking 3/2/1/0 by wins; (b) circular 3-way tie broken by duelDiff; (c) a match decided by Stechschuss counts as a win but contributes 1:1 to Satz; (d) withdrawn participant excluded. (Write concrete fixtures; assert `rank` order and the win/duelDiff numbers — reuse the worked example from spec §7.)

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** using `duelOutcome` + `resolveBestOf`. Keep the function pure (no DB). Reuse the direct-comparison grouping pattern from `calculateStandings.ts` but counting **match wins** within the tied group, then `duelDiff`, then best result.

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Commit** `feat(standings): calculateBestOfStandings with Stechschuss + sort chain`.

---

## Phase 5 — Competition config (create/edit + schedule switch)

### Task 5.1: Validation + action fields

**Files:** Modify `src/lib/competitions/{types,actions}.ts`. Read them + the existing Zod schema first.

- [ ] Extend the LEAGUE create/edit schema with `leagueFormat`, `groupBestOf` (odd, ≥1, default 3), `groupPlayAllDuels` (default **true** in the form for BEST_OF_SINGLE), `groupTiebreaker1/2` (optional, within the 4 allowed modes), `groupHasSuddenDeath` (default true). Restrict `scoringMode` to `RINGS | RINGS_DECIMAL | TEILER | RINGTEILER` when `leagueFormat = BEST_OF_SINGLE`.
- [ ] Lock `leagueFormat`/`groupBestOf`/tiebreak fields once a schedule exists (mirror the existing "regelset gesperrt nach Spielplan-Generierung" guard).
- [ ] **Tests:** action tests (mocked DB, mirror `competitions/actions.test.ts` if present): rejects even `groupBestOf`; rejects TARGET/DECIMAL_REST mode for best-of; rejects edits after schedule exists.
- [ ] **Commit** per green test.

### Task 5.2: Schedule generation switch

**Files:** Modify `src/lib/matchups/actions.ts`.

- [ ] In the generate-schedule action, branch on `competition.leagueFormat`: `BEST_OF_SINGLE` → `generateBestOfSchedule` (single leg); else the existing double round-robin. Persist `Matchup` rows (BYE handling unchanged).
- [ ] **Test:** action test asserts a BEST_OF_SINGLE competition with 4 participants produces 6 matchups (no return leg).
- [ ] **Commit.**

### Task 5.3: Form UI

**Files:** Modify `src/components/app/competitions/CompetitionForm.tsx` (read `ui-patterns.md` + the form first).

- [ ] Add a format selector (Doppelrunde | Best-of). When Best-of: show `groupBestOf` (odd select 3/5/7), `groupPlayAllDuels` (default on), restricted `scoringMode`, and an "erweitert" section for optional `groupTiebreaker1/2` + `groupHasSuddenDeath` (default Stechschuss on). Disable these once a schedule exists.
- [ ] Compliance: `bg-card` on bordered cards; icon buttons `h-10 w-10`; no native dialogs.
- [ ] **Verify** via the preview workflow (create a best-of league, see fields lock after schedule gen). **Commit.**

---

## Phase 6 — Erfassung (duels + Stechschuss)

### Task 6.1: Recording actions

**Files:** Create `src/lib/results/bestOfActions.ts` (or extend `results/actions.ts`). Read `src/lib/playoffs/actions.ts` + `results/actions.ts` for the duel-entry + audit + canCorrect patterns.

- [ ] `saveBestOfDuel(matchupId, duelNumber, homeSeries, awaySeries)` — writes the `Series` pair (with `duelNumber`), recomputes `ringteiler` via `calculateRingteiler`, then evaluates match state with `resolveBestOf`. Auto-advance: if `in_progress`, the UI offers the next duel; if `needs_tiebreak`, the UI offers Stechschuss entry; if `complete`, set `Matchup.status = COMPLETED`.
- [ ] `saveStechschuss(matchupId, homeShot, awayShot)` — writes two `Series` (`isTiebreak = true`, `shotCount = 1`, decimal value in `rings`, `teiler = 0`, next `duelNumber` past N); re-evaluates; completes or asks for another round.
- [ ] Audit events `RESULT_ENTERED` / `RESULT_CORRECTED` with `duelNumber`/tiebreak marker in details.
- [ ] Correction/deletion: only the latest duel/Stechschuss while the match stays consistent (mirror playoff `canCorrect`).
- [ ] **Tests** (mock DB): a TIE duel then a decisive Stechschuss completes the match with the Stechschuss winner; play-all requires all N before completion. **Commit.**

### Task 6.2: Match entry UI

**Files:** Create `src/components/app/matchups/BestOfMatchCard.tsx`. Mirror the playoff duel cards (`src/components/app/playoffs/`).

- [ ] Show the running duel score, per-duel `RingsInput` for both shooters (reuse `src/components/app/series/RingsInput.tsx`), live corrected-teiler hint, and — when level after N — a **Stechschuss** input block (decimal). Use the project dialog (no `window.confirm`).
- [ ] Wire to the Phase 6.1 actions; on `BEST_OF_SINGLE` matchups the schedule page renders `BestOfMatchCard` instead of the single-result dialog.
- [ ] **Verify** via preview (record a 2:1 and a 1:1→Stechschuss). **Commit.**

---

## Phase 7 — Standings, Schedule view & PDF

### Task 7.1: Standings query + table

**Files:** Modify `src/lib/standings/queries.ts`; create `src/components/app/standings/BestOfStandingsTable.tsx`; switch in the standings page by `leagueFormat`.

- [ ] Query loads matchups with their `Series` (regular + tiebreak) for best-of leagues; feed `calculateBestOfStandings`.
- [ ] Table columns: Pl., Name, Begegn., Siege, Niederl., Satzverhältnis (`duelsWon:duelsLost`), Satzdiff., bestes Ergebnis. Withdrawn at bottom. `bg-card`, project date formatter, no bare `toLocaleDateString`.
- [ ] **Verify** via preview against a seeded best-of league. **Commit.**

### Task 7.2: Schedule view switch

**Files:** Modify `src/components/app/matchups/ScheduleView.tsx`.

- [ ] For best-of leagues, render each pairing with its Satz result (e.g. `2:1`, or `1:1 n. St.` when Stechschuss-decided) and **no Heim/Gast labels** (neutral "A – B"). **Commit.**

### Task 7.3: PDF variant

**Files:** Modify/extend `src/lib/pdf/SchedulePdf.tsx`. Read it + `src/lib/pdf/styles.ts` first.

- [ ] Best-of branch: single round-robin list with Satz results + the new table columns; reuse shared styles. The public PDF route stays phase-aware (Spielplan+Tabelle before playoffs). **Commit.**

---

## Phase 8 — Docs sync

### Task 8.1: Update project docs

**Files:** Modify `.claude/docs/{features,data-model,architecture,reference-files}.md`.

- [ ] `data-model.md`: `LeagueFormat`, new Competition/Series fields, Stechschuss via `isTiebreak`, best-of standings rules.
- [ ] `features.md`: the BEST_OF_SINGLE mode, Stechschuss, gemeinsame Terminabstimmung, table columns.
- [ ] `architecture.md`: new files (`lib/scoring/bestOf.ts`, `calculateBestOfStandings.ts`, `generateBestOfSchedule.ts`, `BestOfMatchCard.tsx`, `BestOfStandingsTable.tsx`).
- [ ] `reference-files.md`: best-of patterns. **Commit.**

---

## Integration (after the branch is complete)

Not a coding task, but record it:

1. In `main` (docker works): apply the migration (`prisma migrate dev` / deploy), run the full dockerized `/check`.
2. Reconcile with the parallel **teiler-faktor** change — both touch the Ringteiler/`determineOutcome` area; verify `duelOutcome`/`calculateRingteiler` still agree with the corrected teiler-faktor semantics.
3. Merge `feat/liga-best-of-modus` into `main` with `git merge --ff-only`, then remove the worktree + branch.

---

## Self-Review notes (author)

- **Spec coverage:** Entsch. 1–10 + 5a mapped → Phase 1 (1,3,8 schema), Phase 2 (4,5,6 duel/tie), Phase 4+7 (7 table), Phase 5 (config), Phase 6 (5a Stechschuss-Erfassung), Phase 7 (9 Terminabstimmung in ScheduleView/PDF, 10 playoffs untouched). ✔
- **Stechschuss erfassbar** (Entsch. 5a) — explicit in Task 6.1/6.2 + Risk in spec §13. ✔
- **playAll semantics** — pinned to "exactly N duels, then majority/Stechschuss" in Task 2.1 (matches spec §4). ✔
- **Type consistency** — `DuelOutcome`/`DuelSeries`/`BestOfStatus` defined in Task 2.1/2.2 and reused in 4.1/6.1. ✔
