# Design: Quick Wins Refactoring

**Datum:** 2026-03-29
**Scope:** Drei unabhängige Refactorings zur Reduktion von Duplikation und Verbesserung der Typsicherheit

---

## Kontext

Die Analyse ergab drei Kategorien von Quick Wins:

1. ScoringMode-Label-Maps lokal dupliziert in 4 Dateien
2. Zod-Enums für `TeamScoring`, `TargetValueType` und Playoff-Scoring-Modi hardkodiert statt typsicher
3. Kein zentraler Display-Name-Formatter für Gastteilnehmer

---

## Refactoring 1: Label-Maps konsolidieren

### Problem

In `labels.ts` existiert `SCORING_MODE_LABELS` als zentraler Ort. Trotzdem definieren drei Dateien eigene lokale Maps:

| Datei                                             | Lokale Map                                                      |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `components/app/series/EventRankingTable.tsx`     | `SCORE_LABEL`                                                   |
| `components/app/series/EventTeamRankingTable.tsx` | `TEAM_SCORE_LABEL`                                              |
| `lib/pdf/EventRankingPdf.tsx`                     | `SCORE_LABEL` (obwohl bereits `SCORING_MODE_LABELS` importiert) |
| `components/app/playoffs/PlayoffMatchCard.tsx`    | `FINALE_CRITERIA_LABEL` (4 von 8 Modi)                          |

Die lokalen Maps nutzen **kürzere Spaltenkopf-Labels**, die sich semantisch von `SCORING_MODE_LABELS` unterscheiden:

| Modus           | `SCORING_MODE_LABELS` (Dropdown/Titel) | Spaltenkopf (lokal) |
| --------------- | -------------------------------------- | ------------------- |
| RINGS_DECIMAL   | "Ringe (Zehntel)"                      | "Ringe"             |
| TARGET_ABSOLUTE | "Zielwert absolut"                     | "Abweichung"        |
| TARGET_UNDER    | "Zielwert unter"                       | "Abweichung"        |
| TARGET_OVER     | "Zielwert über"                        | "Abweichung"        |

### Lösung

`labels.ts` bekommt eine zweite Map `SCORING_MODE_COLUMN_LABELS` mit kompakten Spaltenkopf-Labels:

```ts
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

Typisierung als `Record<ScoringMode, string>` stellt sicher, dass neue Modi nie fehlen (TypeScript-Fehler).

### Konsumenten-Änderungen

- `EventRankingTable.tsx`: lokales `SCORE_LABEL` entfernen → `SCORING_MODE_COLUMN_LABELS` importieren
- `EventTeamRankingTable.tsx`: lokales `TEAM_SCORE_LABEL` entfernen → dto.
- `EventRankingPdf.tsx`: lokales `SCORE_LABEL` entfernen → `SCORING_MODE_COLUMN_LABELS` hinzufügen
- `PlayoffMatchCard.tsx`: lokales `FINALE_CRITERIA_LABEL` entfernen → `SCORING_MODE_LABELS` importieren (Vollständige Map, nur 4 Werte genutzt — kein separates Objekt nötig)

---

## Refactoring 2: Zod-Enums typsicher machen

### Problem

In `src/lib/competitions/actions/_shared.ts` sind drei Felder mit hardkodierten Strings validiert:

```ts
teamScoring: z.enum(["SUM", "BEST"]) // Zeile 48
targetValueType: z.enum(["TEILER", "RINGS", "RINGS_DECIMAL"]) // Zeile 58
finalePrimary: z.enum(["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"]) // Zeile 89
finaleTiebreaker1: z.enum(["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"]) // Zeile 93
finaleTiebreaker2: z.enum(["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"]) // Zeile 97
```

Neuer Prisma-Enum-Wert → TypeScript weiß nichts davon → stille Validierungsfehler möglich.

### Lösung

**`teamScoring` und `targetValueType`** → `z.nativeEnum()`:

```ts
import { ScoringMode, TeamScoring, TargetValueType } from "@/generated/prisma/client"

teamScoring: z.nativeEnum(TeamScoring)
  .nullable()
  .optional()
  .transform((v) => v || null)
targetValueType: z.nativeEnum(TargetValueType)
  .nullable()
  .optional()
  .transform((v) => v || null)
```

**Playoff-Scoring-Modi** → Konstante extrahieren, 3× referenzieren:

```ts
const PLAYOFF_SCORING_MODES = ["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"] as const

finalePrimary: z.preprocess(
  v => (!v || v === "" ? "RINGS" : v),
  z.enum(PLAYOFF_SCORING_MODES)
),
finaleTiebreaker1: z.preprocess(
  v => (v === "none" || v === "" || !v ? null : v),
  z.enum(PLAYOFF_SCORING_MODES).nullable()
),
finaleTiebreaker2: z.preprocess(
  v => (v === "none" || v === "" || !v ? null : v),
  z.enum(PLAYOFF_SCORING_MODES).nullable()
),
```

Hinweis: `PLAYOFF_SCORING_MODES` bleibt bewusst als String-Literal-Array (nicht `z.nativeEnum(ScoringMode)`), da es eine **Teilmenge** der ScoringModes ist — TARGET-Modi sind für Playoffs nicht zulässig.

---

## Refactoring 3: Guest-Display-Name-Formatter

### Problem

Es gibt keinen zentralen Formatter für Teilnehmer-Anzeigenamen. Gastteilnehmer (`isGuestRecord: true`) sollen nur mit Vornamen angezeigt werden; reguläre Teilnehmer als "Nachname, Vorname".

### Lösung

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

Aktuell kein bestehender Code wird geändert — der Formatter liegt bereit für zukünftige Nutzung. Kein Risiko, kein Breaking Change.

---

## Teststrategie

- Refactoring 1 & 2: Keine neuen Tests nötig — rein strukturelle Änderungen, bestehende Tests müssen weiterhin grün sein.
- Refactoring 3: Unit-Test für `formatParticipantName` mit drei Cases:
  - Regulärer Teilnehmer → "Nachname, Vorname"
  - Gastteilnehmer → nur Vorname
  - Gastteilnehmer ohne Nachname → nur Vorname (robustness)

---

## Nicht im Scope

- Einbau von `formatParticipantName` in bestehende Render-Orte (eigene Session)
- Dateigrößen-Splits (Phase 2+)
- Weitere Zod-Schemas außerhalb von `_shared.ts`
