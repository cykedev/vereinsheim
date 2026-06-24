# Validate: Best-Off — direkter Vergleich als letztes Tabellen-Kriterium

> PIV-Schritt 3 (validate). Plan: [plans/2026-06-24-best-of-direktvergleich.md](../plans/2026-06-24-best-of-direktvergleich.md).
> Branch: `feat/best-of-direktvergleich` (Commits ef282a7 … df619d5).

## Was verifiziert wurde

| Bereich | Methode | Ergebnis |
| --- | --- | --- |
| Alle 5 Quality-Gates | `pnpm -w run check` (frisch) | **grün** — `Tasks: 17 successful, 17 total` (12,0 s) |
| Sort-/Annotations-Logik | `vitest run` (gezielt) | **grün** |
| PDF-Anzeige (real gerendert) | `vitest` + `renderToBuffer` + `extractPdfText` | **grün** — „Direktvergleich"/„2:1"/„offen" im PDF-Output gefunden |
| Doku-Index | `node .claude/build-graph.mjs` | **grün** — 115 Entities, 165 Relationen |

## Gate-Output (frisch, dieser Lauf)

```
pnpm -w run check
 Tasks:    17 successful, 17 total
Cached:    12 cached, 17 total
  Time:    12.017s
```

Deckt für beide Apps ab: `lint`, `format:check`, `test`, `check-types` (tsc), `next build`.
`next build` lief grün → keine Build-only-Fehler im PDF/Server-Pfad. `tsc` grün → die neue Row-Property
`directComparison` fließt typkorrekt über `queries.ts` in Tabelle + PDF; die Entfernung der `scoringMode`-
Prop (Tabelle + 2 Aufrufer) und der `scoringType`-Prop (PDF + 2 Routen) ist konsistent.

## Verhaltens-Checks (Evidenz)

**Logik — `vitest run` über die geänderten Dateien:**

```
Test Files  4 passed (4)
     Tests  65 passed (65)
```

Abgedeckte Pfade (Auszug):
- `bestOfStandingsSort.test.ts`: 2er-Gleichstand entschieden (Sieger oben, gegen die Alphabetik) ·
  2er offen → alphabetisch + `open` · kein Gleichstand → `directComparison = null` ·
  Position-4-Garantie (Satzdiff trennt vor head-to-head) · 3er linear (`record`) · 3er zyklisch
  (`even`, alphabetisch) · 3er mit offener interner Begegnung (`open`).
- `formatDirectComparison.test.ts`: alle vier `kind`-Fälle + `null` (Text + Ton).
- `calculateBestOfStandings.test.ts`: Test 6 = open-Pfad end-to-end (A & B beide gegen C, nie
  gegeneinander → alphabetisch + `open`), Test 7 = decided-Pfad (4er-Round-Robin, A & B gleich auf
  wins/Satzdiff/Satzverhältnis, A schlägt B direkt → A oben, `decided`). Bestehende Tests (Satzdiff
  trennt vor head-to-head) weiter grün, Kommentare korrigiert.

**PDF — real gerendert (`BestOfSchedulePdf.test.tsx`, `renderToBuffer` → `extractPdfText`):**
Der dekomprimierte PDF-Text enthält nachweislich `Direktvergleich` (Spaltenkopf), `2:1` und `1:2`
(Satz aus eigener Sicht), die Gegner-/Namensfelder `Huber`/`Schmidt` sowie im zweiten Fall `offen`.
→ Die letzte Spalte landet korrekt im PDF (der explizite User-Wunsch „muss ins PDF").

## Offen / Empfehlungen

1. **On-Screen-Tabelle im Browser** wurde nicht über den Dev-Server durchgeklickt (kein Best-Of-
   Wettbewerb mit gezieltem Gleichstand in der Dev-DB). Risiko gering: die Tabelle ist reines JSX über
   dieselben getesteten Daten (`directComparison`) + denselben getesteten Formatter wie das real
   gerenderte PDF. **Empfohlener manueller Blick** an einer echten Best-Of-Liga mit 2er-Gleichstand
   (Spalte „Direktvergleich" → „x:y · Gegner"; offene Begegnung → „offen · Gegner"; sonst „—").
2. **Domänen-Gegenprüfung mit dem Sportleiter** (Plan §Offene Punkte, Lehre aus `stechschuss-modell-flip`):
   Kriterien-Reihenfolge (Position 4) + alphabetischer Fallback am echten Datensatz bestätigen. Logik
   zentral in `bestOfStandingsSort.ts` → ein späterer Flip berührt nur eine Stelle.
3. **`bestRingteiler`/`bestRings`** bleiben berechnet, aber unbenutzt (bewusst revert-fähig, kommentiert).
   Falls der Review „kein totes Datenfeld" bevorzugt: entfernbar (Row-Typ + calculate).

## Fazit

Alle Gates grün, Logik + PDF-Anzeige durch frische Test-Evidenz bestätigt. Bereit für `/review`.
Offene Punkte sind nicht-blockierend (manueller Browser-Blick + Sportleiter-Abnahme).
