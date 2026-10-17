# Plan: Neue Rekorde auf Start begrenzen

## Context (warum)

Start zeigt unter jedem Abend alle Rekorde, deren Scheibe am Abend liegt (`packages/shot-ui/src/start/model.ts`,
`records`; gezeichnet in `EveningBlock.tsx`, Block `data-new-records`), ohne Obergrenze. Seit den neuen Rekorden
(Zehner je Serie, Folge ohne Schuss unter 9, schwächster Schuss, Spanne der Serien) bringt schon die erste Scheibe einer
neuen Schusszahl sieben oder mehr Zeilen, der erste Abend einer Familie rund 15. Der Fortschritt zeigt oben höchstens
fünf (`NEW_RECORDS` in `PeriodInsights.tsx`) und alle zugeklappt darunter.

## Approach

Wie im Fortschritt: Start zeigt höchstens **fünf** neue Rekorde in der Reihenfolge des Katalogs (`recordRows`).
Gibt es mehr, steht darunter ein Link in den Fortschritt der Familie, Abschnitt Analyse, wo alle Rekorde stehen:

- „Noch 1 weiterer Rekord im Fortschritt ›“
- „Noch 3 weitere Rekorde im Fortschritt ›“

(Textbuch §10: Ort in der App nennen, der Link sagt, was man bekommt.) Gibt es höchstens fünf, ändert sich nichts.

Das Modell liefert die Route wie `StartForm.route` (`progressRoute`), der Baustein zeichnet nur.

## Files to change

- `packages/shot-ui/src/start/model.ts`: `START_RECORDS = 5`; `EveningBlock.records` nur die ersten fünf;
  neu `moreRecords: number` (die übrigen) und `recordsRoute: ProgressRoute`
  (`progressRoute(initialPeriodState({ family, scoring }), "analysis")`)
- `packages/shot-ui/src/start/EveningBlock.tsx`: unter der Liste, wenn `moreRecords > 0`, `RouteLink` mit
  `data-more-records` und dem Text oben (Stil wie „Abend in Scheiben ›“)
- `packages/shot-ui/src/start/model.test.ts`, `packages/shot-ui/src/start/EveningBlock.test.tsx`: Tests
- `packages/shot-ui/src/start/sentence.test.ts`: Fixture um `moreRecords`, `recordsRoute` ergänzen, falls der Typ es
  verlangt
- `packages/shot-ui/CLAUDE.md` (Abschnitt Start: „höchstens fünf neue Rekorde, dann Link in den Fortschritt“)

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Start, Rahmen und Links), `vault/conventions.md` §10

## Tasks (/implement)

### T1. Modell und Baustein (ein Commit)

Test zuerst:
- `model.test.ts` „neue Rekorde: höchstens fünf, der Rest als Zahl mit Weg in den Fortschritt“: der erste Abend einer
  Familie (eine Scheibe `e`, keine davor) setzt mehr als fünf Rekorde; `records` hat Länge 5 und ist der Anfang von
  `recordRows(projectedRecords(…))` in derselben Reihenfolge; `moreRecords` = Gesamtzahl − 5;
  `urlFromRoute(recordsRoute)` ist `/progress?family=lg-freihand#analysis` (Familie aus dem Test). Ein Abend mit
  höchstens fünf: `moreRecords` 0.
- `EveningBlock.test.tsx`: mit `moreRecords: 3` steht `<a href="/progress?family=…#analysis" … data-more-records>Noch 3
  weitere Rekorde im Fortschritt ›</a>`, mit 1 „Noch 1 weiterer Rekord im Fortschritt ›“, mit 0 kein
  `data-more-records`.

Dann der Code wie oben.

### T2. Scope-Notiz

`packages/shot-ui/CLAUDE.md`, Abschnitt Start: Zeile „Neue Rekorde sind die, deren Scheibe am Abend liegt.“ ergänzen
um „höchstens fünf in der Reihenfolge des Katalogs, darunter ‚Noch N weitere … im Fortschritt ›‘ (Abschnitt Analyse)“.

## Test steps

```bash
pnpm --filter @vereinsheim/shot-ui test
```

```bash
pnpm check
```

## Validate

Dev-Server :3002 (Dev-DB): Start zeigt je Block höchstens fünf neue Rekorde. Gibt es mehr, führt der Link in den
Fortschritt, Abschnitt Analyse, dort stehen die übrigen. Geben die Dev-Daten keinen Abend mit mehr als fünf her, ist
das „nicht belegt“, abgedeckt durch die Tests aus T1.

## Verification

Kein Abend auf Start zeigt mehr als fünf Rekorde; die übrigen sind einen Klick entfernt; `pnpm check` grün.
