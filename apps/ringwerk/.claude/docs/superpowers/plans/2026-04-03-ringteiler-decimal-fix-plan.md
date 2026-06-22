# Ringteiler Decimal Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Ringteiler-Berechnung für Zehntelwertungs-Disziplinen (DECIMAL, max 109 Ringe) in gemischten Events und korrigiere falsch gespeicherte Ringteiler-Werte in bestehenden Serien.

**Architecture:** Zwei unabhängige Fixes: (1) Code-Fix in `rankEventParticipants` — jede Serie verwendet `s.discipline.scoringType` statt des Competition-Level-Fallback auf WHOLE; dafür muss `scoringType` zum `EventSeriesItem`-Typ und zur Query hinzugefügt werden. (2) Data-Fix — Prisma-Migration mit Raw-SQL recomputed alle gespeicherten Ringteiler-Werte in der `Series`-Tabelle, bei denen die Disziplin DECIMAL ist.

**Tech Stack:** TypeScript, Prisma ORM, Vitest, Next.js Server Actions, PostgreSQL

---

## Required Docs

- `.claude/docs/code-conventions.md` — immer
- `.claude/docs/reference-files.md` — immer
- `.claude/docs/architecture.md` — Layer-Reihenfolge
- `.claude/docs/data-model.md` — Domainverständnis

---

## Hintergrund (für Subagenten)

**Problem:** In gemischten Events (kein feste Disziplin, `config.discipline = null`) berechnet `rankEventParticipants` den Ranking-Score für RINGTEILER-Modus immer mit `maxRings = 100`, auch wenn einzelne Teilnehmer Zehntelwertungs-Disziplinen haben (DECIMAL, max 109). Das vertauscht die Rangliste.

**Zusätzlich:** Bestehende Serien mit DECIMAL-Disziplinen wurden mit `maxRings = 100` gespeichert (z.B. Kranzl 2026: LPA-Teilnehmer zeigt RT 6.0 statt korrekt 15.0).

**Konkrete Werte aus Produktion:**

- Markus Beyer (Luftpistole Auflage = DECIMAL): Ringe 100, Teiler 6.0
  - Gespeichert: RT = 6.0 = 100 − 100 + 6 ← FALSCH
  - Korrekt: RT = 15.0 = 109 − 100 + 6
- Christian Eiden (Luftpistole = WHOLE): Ringe 99, Teiler 11.3
  - Gespeichert: RT = 12.3 = 100 − 99 + 11.3 ← korrekt
- Folge: Markus erscheint als Platz 1, Christian als Platz 2. Korrekt wäre Christian Platz 1 (RT 12.3 < 15.0).

**Formel:** `Math.round((maxRings − rings + teiler × faktor) × 10) / 10`

- WHOLE: maxRings = 100
- DECIMAL: maxRings = 109

---

## Datei-Übersicht

| Datei                                                                      | Änderung                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/series/types.ts`                                                  | `scoringType: ScoringType` zu `EventSeriesItem.discipline` hinzufügen        |
| `src/lib/competitions/queries.ts`                                          | `scoringType: true` in discipline-Select der Series-Query                    |
| `src/lib/scoring/rankEventParticipants.ts`                                 | `s.discipline.scoringType` statt `config.discipline?.scoringType ?? "WHOLE"` |
| `src/lib/scoring/rankEventParticipants.test.ts`                            | `makeSeries`-Helper updaten + neuer Test für DECIMAL in gemischtem Event     |
| `prisma/migrations/<timestamp>_recompute_decimal_ringteiler/migration.sql` | Raw SQL: Ringteiler für DECIMAL-Serien neu berechnen                         |

---

## Task 1: Failing Test schreiben (DECIMAL-Disziplin in gemischtem Event)

**Files:**

- Modify: `src/lib/scoring/rankEventParticipants.test.ts`

- [ ] **Schritt 1: Test hinzufügen — vor jeder Codeänderung**

In `rankEventParticipants.test.ts`, innerhalb des `describe("rankEventParticipants")` Blocks, nach dem letzten bestehenden `it(...)`:

```typescript
it("RINGTEILER: gemischter Event — DECIMAL-Disziplin verwendet maxRings=109", () => {
  // Kranzl-2026-Szenario: LP (WHOLE) vs LPA (DECIMAL)
  // Korrekt: LPA-RT = 109 − 100 + 6 = 15.0, LP-RT = 100 − 99 + 11.3 = 12.3
  // → LP gewinnt (12.3 < 15.0)
  const series = [
    makeSeries({
      participantId: "LPA",
      rings: 100,
      teiler: 6.0,
      ringteiler: 15.0,
      discipline: {
        name: "Luftpistole Auflage",
        teilerFaktor: 1.0,
        scoringType: "DECIMAL" as const,
      },
    }),
    makeSeries({
      participantId: "LP",
      rings: 99,
      teiler: 11.3,
      ringteiler: 12.3,
      discipline: { name: "Luftpistole", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
    }),
  ]
  const mixedConfig = {
    scoringMode: "RINGTEILER" as const,
    targetValue: null,
    targetValueType: null,
    discipline: null, // Gemischt — kein Competition-Level-scoringType
  }
  const result = rankEventParticipants(series, mixedConfig)
  // LP (RT 12.3) muss vor LPA (RT 15.0) liegen
  expect(result[0].participantId).toBe("LP")
  expect(result[1].participantId).toBe("LPA")
  expect(result[0].rank).toBe(1)
  expect(result[1].rank).toBe(2)
})
```

> Hinweis: Dieser Test kompiliert erst, nachdem `scoringType` zu `EventSeriesItem.discipline` hinzugefügt wurde (Task 2). Trotzdem jetzt schreiben — der Test dokumentiert das gewünschte Verhalten.

- [ ] **Schritt 2: Test scheitern lassen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/rankEventParticipants.test.ts
```

Erwartetes Ergebnis: TypeScript-Fehler (scoringType im Typ fehlt) oder Test schlägt fehl mit falscher Reihenfolge (LP auf Platz 2, LPA auf Platz 1).

---

## Task 2: `scoringType` zu EventSeriesItem und Query hinzufügen

**Files:**

- Modify: `src/lib/series/types.ts`
- Modify: `src/lib/competitions/queries.ts`

- [ ] **Schritt 1: Typ erweitern**

In `src/lib/series/types.ts`, den Import ergänzen und `discipline` in `EventSeriesItem` anpassen:

```typescript
import type { ScoringType } from "@/generated/prisma/client"

export type EventSeriesItem = {
  id: string
  participantId: string
  competitionParticipantId: string | null
  disciplineId: string
  discipline: {
    name: string
    teilerFaktor: number
    scoringType: ScoringType // NEU
  }
  participant: {
    id: string
    firstName: string
    lastName: string
  }
  isGuest: boolean
  teamNumber: number | null
  rings: number
  teiler: number
  ringteiler: number
  shots: number[]
  shotCount: number
  sessionDate: Date
}
```

`SeasonSeriesItem` braucht kein `scoringType` — Saison-Wettbewerbe haben keine per-Serie DECIMAL-Berechnung im Ranking.

- [ ] **Schritt 2: Query erweitern**

In `src/lib/competitions/queries.ts`, die Series-Discipline-Select in `getEventWithSeries` (Zeile ~111):

```typescript
discipline: { select: { name: true, teilerFaktor: true, scoringType: true } },
```

Und das Mapping (Zeile ~155) anpassen:

```typescript
discipline: {
  name: s.discipline.name,
  teilerFaktor: s.discipline.teilerFaktor.toNumber(),
  scoringType: s.discipline.scoringType,
},
```

- [ ] **Schritt 3: `makeSeries`-Helper im Test anpassen**

Da `EventSeriesItem.discipline` jetzt `scoringType` braucht, muss der Helper in `rankEventParticipants.test.ts` einen Default haben:

```typescript
discipline: overrides.discipline ?? { name: "LG", teilerFaktor: 1.0, scoringType: "WHOLE" as const },
```

- [ ] **Schritt 4: TypeCheck**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

---

## Task 3: `rankEventParticipants` — per-Serie scoringType verwenden

**Files:**

- Modify: `src/lib/scoring/rankEventParticipants.ts`

- [ ] **Schritt 1: Zeile 57 fixen**

Aktuell (buggy):

```typescript
const scoringType: ScoringType = config.discipline?.scoringType ?? "WHOLE"
const maxRings = MAX_RINGS[scoringType]
```

Ersetzen durch:

```typescript
const maxRings = MAX_RINGS[s.discipline.scoringType]
```

Die Import-Zeile `import type { ScoringMode, ScoringType, TargetValueType }` — `ScoringType` kann entfernt werden wenn es nirgends mehr direkt gebraucht wird. Prüfen ob `ScoringType` noch in der Datei gebraucht wird; wenn nicht, aus dem Import entfernen.

Der `EventConfig`-Typ behält `discipline: { scoringType: ScoringType } | null` — der Wert wird von Aufrufern weiterhin übergeben (breaking change vermeiden). Die Funktion `rankEventParticipants` liest `config.discipline.scoringType` nicht mehr für maxRings.

- [ ] **Schritt 2: Test laufen lassen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx vitest run src/lib/scoring/rankEventParticipants.test.ts
```

Erwartetes Ergebnis: Alle Tests grün, inkl. neuer DECIMAL-Test.

- [ ] **Schritt 3: Commit**

```
fix(ranking): use per-series discipline scoringType for maxRings in mixed events

In mixed events (config.discipline = null), rankEventParticipants always
fell back to WHOLE (maxRings=100) for the ranking score calculation, even
when individual participants had DECIMAL disciplines (maxRings=109).

Fix: use s.discipline.scoringType (per-series) instead of
config.discipline?.scoringType ?? "WHOLE".

Requires scoringType in EventSeriesItem.discipline type and query.
```

---

## Task 4: Data-Migration — bestehende DECIMAL-Serien neu berechnen

**Files:**

- Create: `prisma/migrations/<timestamp>_recompute_decimal_ringteiler/migration.sql`

Alle gespeicherten `ringteiler`-Werte in der `Series`-Tabelle, bei denen die zugehörige Disziplin `DECIMAL` ist, wurden fälschlicherweise mit maxRings=100 berechnet. Sie müssen auf 109 korrigiert werden.

- [ ] **Schritt 1: Migration erstellen**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate dev --create-only --name recompute_decimal_ringteiler
```

Dies erstellt eine leere Migration unter `prisma/migrations/<timestamp>_recompute_decimal_ringteiler/migration.sql`.

- [ ] **Schritt 2: SQL eintragen**

Die generierte `migration.sql` öffnen und folgenden Inhalt eintragen:

```sql
-- Ringteiler-Neuberechnung für Serien mit DECIMAL-Disziplinen
-- Formel: ROUND((109 - rings + teiler * teilerFaktor) * 10) / 10
-- Entspricht: Math.round((109 - rings + teiler * faktor) * 10) / 10 in TypeScript
UPDATE "Series" s
SET "ringteiler" = ROUND(
  (109.0 - s."rings" + s."teiler" * d."teilerFaktor") * 10
) / 10
FROM "Discipline" d
WHERE s."disciplineId" = d."id"
  AND d."scoringType" = 'DECIMAL';
```

> **Warum ROUND(x \* 10) / 10:** PostgreSQL `ROUND` ohne zweites Argument rundet auf ganzzahlig. Wir multiplizieren mit 10, runden auf Integer, dividieren durch 10 — das entspricht exakt der TypeScript-Formel `Math.round(x * 10) / 10` mit 1 Nachkommastelle.

- [ ] **Schritt 3: Migration anwenden**

```bash
docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate dev
```

Erwartetes Ergebnis: Migration läuft durch, keine Fehler.

- [ ] **Schritt 4: Ergebnis verifizieren (manuell in DB oder via Prisma Studio)**

Prüfe ob die bekannten Werte aus Kranzl 2026 korrekt sind:

- Markus Beyer (LPA, DECIMAL): `ringteiler` sollte jetzt **15.0** sein (vorher 6.0)
  - Formel: 109 − 100 + 6.0 = 15.0
- Christian Eiden (LP, WHOLE): `ringteiler` sollte **unverändert 12.3** sein
- Stefan Schallmoser (LG, WHOLE): `ringteiler` sollte **unverändert 68.0** sein

- [ ] **Schritt 5: Commit**

```
fix(data): recompute ringteiler for DECIMAL disciplines in Series table

Series entries for DECIMAL disciplines (max 109 rings) were previously
stored with ringteiler computed using maxRings=100. This migration
corrects all affected rows.

Affected disciplines: Zehntelringe (scoringType=DECIMAL), e.g. LPA, LGA.
Formula: ROUND((109 - rings + teiler * teilerFaktor) * 10) / 10
```

---

## Task 5: Qualitätssicherung

- [ ] **Schritt 1: Alle Quality Gates**

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint
docker compose -f docker-compose.dev.yml run --rm app npm run format:check
docker compose -f docker-compose.dev.yml run --rm app npm run test
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Alle müssen grün sein.

---

## Self-Review Checkliste

- [x] Test dokumentiert das konkrete Kranzl-2026-Szenario (LP vs LPA)
- [x] `makeSeries`-Helper bekommt `scoringType: "WHOLE"` als Default → bestehende Tests bleiben unverändert
- [x] `EventConfig.discipline` bleibt im Typ erhalten → keine breaking changes für Aufrufer
- [x] Data-Migration deckt `Series`-Tabelle ab (Haupt-Schadensfall)
- [x] `PlayoffDuelResult`: Der Playoff-Code hat immer korrekt `competition.discipline.scoringType` gelesen → kein Handlungsbedarf
- [x] `saveEventSeries` / `saveSeasonSeries`: aktueller Code ist korrekt (nutzt `discipline.scoringType`) → keine Codeänderung
- [x] Keine Placeholder, kein TBD
