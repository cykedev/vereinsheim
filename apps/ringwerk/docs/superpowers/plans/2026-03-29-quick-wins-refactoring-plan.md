# Quick Wins Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei Quick Wins: ScoringMode-Label-Maps zentralisieren, Zod-Enums typsicher machen, Guest-Display-Name-Formatter anlegen.

**Architecture:** Reine strukturelle Refactorings ohne Verhaltensänderung. Labels.ts bekommt eine zweite Map für Spaltenkopf-Kontext. `_shared.ts` nutzt `z.nativeEnum` statt hardkodierter Strings. Neues `formatters.ts` enthält den einzigen neuen Logik-Code.

**Tech Stack:** TypeScript, Zod, Prisma-generated enums, Vitest

---

## Required Docs

- `.claude/docs/code-conventions.md`
- `.claude/docs/reference-files.md`
- `.claude/docs/architecture.md`

---

## Dateiübersicht

| Datei                                                 | Aktion                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/scoring/labels.ts`                           | Modify: `SCORING_MODE_COLUMN_LABELS` hinzufügen                      |
| `src/components/app/series/EventRankingTable.tsx`     | Modify: lokales `SCORE_LABEL` entfernen, Import hinzufügen           |
| `src/components/app/series/EventTeamRankingTable.tsx` | Modify: lokales `TEAM_SCORE_LABEL` entfernen, Import hinzufügen      |
| `src/lib/pdf/EventRankingPdf.tsx`                     | Modify: lokales `SCORE_LABEL` entfernen, Import ergänzen             |
| `src/components/app/playoffs/PlayoffMatchCard.tsx`    | Modify: lokales `FINALE_CRITERIA_LABEL` entfernen, Import hinzufügen |
| `src/lib/competitions/actions/_shared.ts`             | Modify: `z.nativeEnum` + `PLAYOFF_SCORING_MODES`-Konstante           |
| `src/lib/participants/formatters.ts`                  | Create: `formatParticipantName`                                      |
| `src/lib/participants/formatters.test.ts`             | Create: Unit-Tests für `formatParticipantName`                       |

---

## Task 1: `SCORING_MODE_COLUMN_LABELS` in `labels.ts` hinzufügen

**Files:**

- Modify: `src/lib/scoring/labels.ts`

- [ ] **Schritt 1: `labels.ts` lesen und zweite Map ergänzen**

Ersetze den gesamten Inhalt von `src/lib/scoring/labels.ts`:

```ts
import type { ScoringMode } from "@/generated/prisma/client"

export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe (Zehntel)",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Zielwert absolut",
  TARGET_UNDER: "Zielwert unter",
  TARGET_OVER: "Zielwert über",
}

export const SCORING_MODE_COLUMN_LABELS: Record<ScoringMode, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe (Ztl.)",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Abweichung",
  TARGET_UNDER: "Abw. (≤ Ziel)",
  TARGET_OVER: "Abw. (≥ Ziel)",
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine Fehler.

---

## Task 2: `EventRankingTable.tsx` – lokale Map ersetzen

**Files:**

- Modify: `src/components/app/series/EventRankingTable.tsx`

- [ ] **Schritt 1: Import hinzufügen, lokale Map entfernen**

Ersetze Zeilen 1–21:

```tsx
import type { EventRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
import { Badge } from "@/components/ui/badge"
import { RankBadge } from "@/components/ui/rank-badge"

interface Props {
  entries: EventRankedEntry[]
  scoringMode: string
  isMixed?: boolean
  showTeam?: boolean
}
```

- [ ] **Schritt 2: Verwendung anpassen**

Zeile 33 (vorher `const scoreLabel = SCORE_LABEL[scoringMode] ?? "Score"`):

```tsx
const scoreLabel =
  SCORING_MODE_COLUMN_LABELS[scoringMode as keyof typeof SCORING_MODE_COLUMN_LABELS] ?? "Score"
```

---

## Task 3: `EventTeamRankingTable.tsx` – lokale Map ersetzen

**Files:**

- Modify: `src/components/app/series/EventTeamRankingTable.tsx`

- [ ] **Schritt 1: Import hinzufügen, lokale Map entfernen**

Ersetze Zeilen 1–19:

```tsx
import type { EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
import { RankBadge } from "@/components/ui/rank-badge"

interface Props {
  entries: EventTeamRankedEntry[]
  scoringMode: string
  teamScoring: "SUM" | "BEST"
}
```

- [ ] **Schritt 2: Verwendung anpassen**

Zeile 26 (vorher `const scoreLabel = TEAM_SCORE_LABEL[scoringMode] ?? "Score"`):

```tsx
const scoreLabel =
  SCORING_MODE_COLUMN_LABELS[scoringMode as keyof typeof SCORING_MODE_COLUMN_LABELS] ?? "Score"
```

---

## Task 4: `EventRankingPdf.tsx` – lokale Map entfernen

**Files:**

- Modify: `src/lib/pdf/EventRankingPdf.tsx`

- [ ] **Schritt 1: Import in Zeile 5 ergänzen**

Ersetze:

```ts
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"
```

Mit:

```ts
import { SCORING_MODE_LABELS, SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
```

- [ ] **Schritt 2: Lokales `SCORE_LABEL` entfernen (Zeilen 37–46)**

Entferne den Block:

```ts
const SCORE_LABEL: Record<string, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Abweichung",
  TARGET_UNDER: "Abweichung",
  TARGET_OVER: "Abweichung",
}
```

- [ ] **Schritt 3: Alle Verwendungen von `SCORE_LABEL` ersetzen**

Zeile 82 (in `TeamRankingTable`):

```tsx
const scoreLabel = SCORING_MODE_COLUMN_LABELS[scoringMode] ?? "Score"
```

Zeile 140 (in `RankingTable`):

```tsx
const scoreLabel = SCORING_MODE_COLUMN_LABELS[scoringMode] ?? "Score"
```

---

## Task 5: `PlayoffMatchCard.tsx` – lokale Map ersetzen

**Files:**

- Modify: `src/components/app/playoffs/PlayoffMatchCard.tsx`

- [ ] **Schritt 1: Import hinzufügen**

Bestehende Imports (vor Zeile 25) ergänzen:

```tsx
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"
```

- [ ] **Schritt 2: Lokales `FINALE_CRITERIA_LABEL` entfernen**

Entferne Zeilen 25–30:

```ts
const FINALE_CRITERIA_LABEL: Record<string, string> = {
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe (Zehntel)",
  RINGTEILER: "Ringteiler",
  TEILER: "Teiler",
}
```

- [ ] **Schritt 3: `finaleHintText` anpassen**

Zeile 37 (vorher `const label = (m: ScoringMode) => FINALE_CRITERIA_LABEL[m] ?? m`):

```ts
const label = (m: ScoringMode) => SCORING_MODE_LABELS[m] ?? m
```

- [ ] **Schritt 4: TypeScript + Tests prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 5: Commit (Tasks 1–5)**

```bash
git add src/lib/scoring/labels.ts \
        src/components/app/series/EventRankingTable.tsx \
        src/components/app/series/EventTeamRankingTable.tsx \
        src/lib/pdf/EventRankingPdf.tsx \
        src/components/app/playoffs/PlayoffMatchCard.tsx
git commit -m "refactor(scoring): centralize ScoringMode label maps

Add SCORING_MODE_COLUMN_LABELS to labels.ts for table header context.
Remove local duplicates from EventRankingTable, EventTeamRankingTable,
EventRankingPdf and PlayoffMatchCard."
```

---

## Task 6: Zod-Enums in `_shared.ts` typsicher machen

**Files:**

- Modify: `src/lib/competitions/actions/_shared.ts`

- [ ] **Schritt 1: Imports erweitern**

Zeile 3 (vorher `import { ScoringMode } from "@/generated/prisma/client"`):

```ts
import { ScoringMode, TeamScoring, TargetValueType } from "@/generated/prisma/client"
```

- [ ] **Schritt 2: `PLAYOFF_SCORING_MODES`-Konstante einfügen**

Nach den Imports (vor `export function parseDate`), neue Konstante:

```ts
const PLAYOFF_SCORING_MODES = ["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"] as const
```

- [ ] **Schritt 3: `teamScoring`-Feld ersetzen (Zeilen 48–52)**

Ersetze:

```ts
teamScoring: z
  .enum(["SUM", "BEST"])
  .nullable()
  .optional()
  .transform((v) => v || null),
```

Mit:

```ts
teamScoring: z
  .nativeEnum(TeamScoring)
  .nullable()
  .optional()
  .transform((v) => v || null),
```

- [ ] **Schritt 4: `targetValueType`-Feld ersetzen (Zeilen 58–62)**

Ersetze:

```ts
targetValueType: z
  .enum(["TEILER", "RINGS", "RINGS_DECIMAL"])
  .nullable()
  .optional()
  .transform((v) => v || null),
```

Mit:

```ts
targetValueType: z
  .nativeEnum(TargetValueType)
  .nullable()
  .optional()
  .transform((v) => v || null),
```

- [ ] **Schritt 5: Playoff-Tiebreaker-Felder auf Konstante umstellen (Zeilen 87–98)**

Ersetze:

```ts
finalePrimary: z.preprocess(
  (v) => (!v || v === "" ? "RINGS" : v),
  z.enum(["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"])
),
finaleTiebreaker1: z.preprocess(
  (v) => (v === "none" || v === "" || !v ? null : v),
  z.enum(["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"]).nullable()
),
finaleTiebreaker2: z.preprocess(
  (v) => (v === "none" || v === "" || !v ? null : v),
  z.enum(["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"]).nullable()
),
```

Mit:

```ts
finalePrimary: z.preprocess(
  (v) => (!v || v === "" ? "RINGS" : v),
  z.enum(PLAYOFF_SCORING_MODES)
),
finaleTiebreaker1: z.preprocess(
  (v) => (v === "none" || v === "" || !v ? null : v),
  z.enum(PLAYOFF_SCORING_MODES).nullable()
),
finaleTiebreaker2: z.preprocess(
  (v) => (v === "none" || v === "" || !v ? null : v),
  z.enum(PLAYOFF_SCORING_MODES).nullable()
),
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Schritt 7: Commit**

```bash
git add src/lib/competitions/actions/_shared.ts
git commit -m "refactor(competitions): use z.nativeEnum for TeamScoring and TargetValueType

Extract PLAYOFF_SCORING_MODES constant to avoid triple duplication.
Replace hardcoded z.enum strings with z.nativeEnum where applicable."
```

---

## Task 7: `formatParticipantName` – TDD

**Files:**

- Create: `src/lib/participants/formatters.test.ts`
- Create: `src/lib/participants/formatters.ts`

- [ ] **Schritt 1: Failing test schreiben**

Neue Datei `src/lib/participants/formatters.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { formatParticipantName } from "./formatters"

describe("formatParticipantName", () => {
  it("regulärer Teilnehmer → Nachname, Vorname", () => {
    expect(
      formatParticipantName({ firstName: "Max", lastName: "Mustermann", isGuestRecord: false })
    ).toBe("Mustermann, Max")
  })

  it("Gastteilnehmer → nur Vorname", () => {
    expect(formatParticipantName({ firstName: "Gabi", lastName: "", isGuestRecord: true })).toBe(
      "Gabi"
    )
  })

  it("Gastteilnehmer mit Nachname → trotzdem nur Vorname", () => {
    expect(
      formatParticipantName({ firstName: "Klaus", lastName: "Schmidt", isGuestRecord: true })
    ).toBe("Klaus")
  })
})
```

- [ ] **Schritt 2: Test laufen lassen – muss scheitern**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/participants/formatters.test.ts
```

Erwartet: FAIL mit "Cannot find module './formatters'"

- [ ] **Schritt 3: Implementierung schreiben**

Neue Datei `src/lib/participants/formatters.ts`:

```ts
export function formatParticipantName(participant: {
  firstName: string
  lastName: string
  isGuestRecord: boolean
}): string {
  if (participant.isGuestRecord) return participant.firstName
  return `${participant.lastName}, ${participant.firstName}`
}
```

- [ ] **Schritt 4: Tests laufen lassen – müssen grün sein**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/participants/formatters.test.ts
```

Erwartet: 3 passed.

- [ ] **Schritt 5: Vollständigen Check ausführen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint && \
docker compose -f docker-compose.dev.yml run --rm app npm run format:check && \
docker compose -f docker-compose.dev.yml run --rm app npm run test && \
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartet: alle Gates grün.

- [ ] **Schritt 6: Commit**

```bash
git add src/lib/participants/formatters.ts src/lib/participants/formatters.test.ts
git commit -m "feat(participants): add formatParticipantName formatter

Central display name formatter: guests show first name only,
regular participants show 'Nachname, Vorname'."
```
