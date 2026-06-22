# Design: Ringe-Validierung & Formatierung

**Datum:** 2026-04-03
**Status:** Approved

---

## Ziel

Einheitliche Validierung (client + server) und Darstellung (Input + Tabellen + PDFs) von Ringe- und Teiler-Werten — abhängig vom effektiven ScoringType des Kontexts.

---

## Kernregel: Effektiver ScoringType

Der effektive ScoringType bestimmt, ob Ringe ganzzahlig (WHOLE) oder dezimal (DECIMAL) sind.

| ScoringMode                        | Effektiver ScoringType        |
| ---------------------------------- | ----------------------------- |
| `RINGS`                            | `WHOLE` (explizit ganzzahlig) |
| `RINGS_DECIMAL`                    | `DECIMAL`                     |
| `DECIMAL_REST`                     | `DECIMAL`                     |
| `RINGTEILER`, `TEILER`, `TARGET_*` | → `discipline.scoringType`    |

Bei gemischten Wettbewerben (kein fixer `disciplineId`) wird die Teilnehmer-Disziplin übergeben.
Bei Saison-Wettbewerben (immer gemischt) wechselt der effektive ScoringType reaktiv mit der Disziplin-Auswahl im Dialog.

---

## Formatierungsregeln

| Wert                      | WHOLE                                    | DECIMAL                                                |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Ringe (Anzeige)           | `"96"` (ganzzahlig, kein Dezimalzeichen) | `"96,5"` (deutsches Komma, 1 Stelle)                   |
| Ringe (Input-Placeholder) | `"z.B. 96"`                              | `"z.B. 96,5"`                                          |
| Teiler (immer)            | —                                        | `"3,7"` / `"12,0"` (immer 1 Nachkommastelle mit Komma) |
| Ringteiler (immer)        | —                                        | `"7,3"` (immer 1 Nachkommastelle mit Komma)            |

Der Teiler und Ringteiler sind **immer** Dezimalwerte mit deutschem Komma — unabhängig vom ScoringType. Beide verwenden `formatDecimal1()`.

---

## Validierungsregeln

| Feld         | WHOLE                 | DECIMAL                 |
| ------------ | --------------------- | ----------------------- |
| Ringe Min    | 0                     | 0.0                     |
| Ringe Max    | `shotsPerSeries × 10` | `shotsPerSeries × 10.9` |
| Ringe Format | Integer (ganzzahlig)  | Dezimal, 1 Stelle       |
| Teiler Min   | 0.0                   | 0.0                     |
| Teiler Max   | 9999.9                | 9999.9                  |

Validierung läuft auf **zwei Ebenen**:

- **Client (Input-Props):** `step`, `inputMode`, `max`-Attribut — verhindert falsche Eingaben sofort
- **Server (Zod):** `getMaxRings()` + `.refine(Number.isInteger)` für WHOLE — zweite Absicherung

Comma→Period-Normalisierung (`v.replace(",", ".")`) bleibt wie bisher in Zod.

---

## Neues Modul: `src/lib/series/scoring-format.ts`

Single source of truth für alle Format- und Validierungslogik.

```ts
// Effektiven ScoringType ableiten
getEffectiveScoringType(
  scoringMode: ScoringMode,
  discipline: { scoringType: ScoringType } | null
): ScoringType

// Maximale Ringe für eine Serie
getMaxRings(scoringType: ScoringType, shotsPerSeries: number): number
// WHOLE: shotsPerSeries × 10
// DECIMAL: shotsPerSeries × 10.9

// Ringe anzeigen (Tabellen, PDFs)
formatRings(value: number | null, scoringType: ScoringType): string
// null → "–"
// WHOLE → "96"
// DECIMAL → "96,5"

// Teiler UND Ringteiler anzeigen (Tabellen, PDFs) — immer Dezimal, 1 Stelle
formatDecimal1(value: number | null): string
// null → "–"
// Immer: "3,7" | "12,0" | "9999,9"

// Input-Props für RingsInput-Komponente
getRingsInputProps(scoringType: ScoringType, shotsPerSeries: number): {
  inputMode: 'numeric' | 'decimal'
  placeholder: string
  step: string
  max: number
}
```

---

## Neue Komponente: `src/components/app/series/RingsInput.tsx`

Dünner Wrapper um `Input`, setzt automatisch die richtigen Props:

```tsx
<RingsInput
  scoringType={effectiveScoringType}
  shotsPerSeries={competition.shotsPerSeries}
  value={rings}
  onChange={...}
  error={...}
/>
```

Intern nutzt er `getRingsInputProps()` — kein zusätzliches Wissen in den Dialogen nötig.

Für den **Teiler** gibt es keine eigene Komponente — der Placeholder wird von `"z.B. 3.7"` auf `"z.B. 3,7"` korrigiert.

---

## Betroffene Stellen

### Berechnung

| Datei                                | Änderung                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `src/lib/results/calculateResult.ts` | `MAX_RINGS`-Konstante (hardcoded auf 10 Schuss) durch `getMaxRings(scoringType, shotsPerSeries)` ersetzen |

### Validierung (server-side)

| Datei                       | Änderung                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/series/actions.ts` | Zod-Schema: `max(getMaxRings(...))` ergänzen; bei WHOLE: `.refine(Number.isInteger)` |

### Dialoge (Input)

| Datei                         | Änderung                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `EventSeriesDialog.tsx`       | `<Input>` → `<RingsInput scoringType={effectiveScoringType} ...>`, Teiler-Placeholder |
| `SeasonSeriesDialog.tsx`      | `<Input>` → `<RingsInput>` (reaktiv auf Disziplin-Auswahl), Teiler-Placeholder        |
| `ResultEntryDialog.tsx`       | `type="number"` → `<RingsInput>`, Teiler-Placeholder                                  |
| `PlayoffDuelResultDialog.tsx` | `type="number"` → `<RingsInput>`, Teiler-Placeholder                                  |

### Tabellen (Display)

**Hinweis gemischte Wettbewerbe:** Bei gemischten Wettbewerben hat jede Zeile ihre eigene Disziplin. Der effektive ScoringType wird daher **pro Zeile** berechnet: `getEffectiveScoringType(competition.scoringMode, entry.discipline)`. Tabellen und PDFs müssen diesen Wert pro Eintrag ermitteln, nicht einmalig für den gesamten Wettbewerb.

| Datei                      | Änderung                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `EventRankingTable.tsx`    | `entry.rings` → `formatRings(entry.rings, getEffectiveScoringType(...))` pro Zeile; Teiler → `formatDecimal1()` |
| `SeasonStandingsTable.tsx` | Ringe → `formatRings()` pro Zeile (je nach Disziplin der Bestleistung); Teiler, Ringteiler → `formatDecimal1()` |
| `StandingsTable.tsx`       | Ringteiler → `formatDecimal1()`                                                                                 |

### PDFs (Display)

| Datei                    | Änderung                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `EventRankingPdf.tsx`    | `entry.rings` → `formatRings()` pro Zeile (effektiver ScoringType); Teiler → `formatDecimal1()`       |
| `SeasonStandingsPdf.tsx` | Lokale `formatRings()`, `formatTeiler()`, `formatRingteiler()` → `formatRings()` + `formatDecimal1()` |
| `SchedulePdf.tsx`        | Lokale `formatRT()`, inline `.toFixed()` → `formatRings()`, `formatDecimal1()`                        |
| `PlayoffsPdf.tsx`        | `totalRings.toFixed(0)`, `ringteiler.toFixed(1)` → `formatRings()`, `formatDecimal1()`                |

---

## Tests

- **Unit-Tests `scoring-format.ts`:** Alle Kombinationen `ScoringMode × ScoringType`, Edge Cases (0, max, null-Wert, null-Disziplin)
- **Actions-Tests:** Max-Ringe-Überschreitung (WHOLE + DECIMAL), Integer-Constraint für WHOLE, bestehende Tests anpassen
- **Dialog-Tests:** Render-Tests prüfen Placeholder- und inputMode-Werte je ScoringType
