# Plan: Spiegel-Rekorde — eindeutige Beschriftung und fünf neue Rekorde

## Context (warum)

Am Live-System stand im Fortschritt (Luftpistole, ganze Ringe) „Meiste Zehner (10 Schuss): 1 · 25.09.2026“, obwohl die
Serie mit 94 Ringen (29.09.2026, Serie 1) fünf Zehner hat. Nachgerechnet aus den Schüssen aller 31 Scheiben der
Familie: **Alle 16 Rekorde sind nach ihrer Definition richtig.** Der Fehler liegt in der Beschriftung:

- „(10 Schuss)“ heißt bei „Beste Serie“ *Serie zu zehn*, bei „Bestes Ergebnis“, „Engste Scheibe“, „Meiste Zehner“,
  „Meiste Innenzehner“ und „Meiste 10,9“ aber *Scheibe mit zehn Schuss*. Die 1 kommt von einer Probe-Scheibe zu zehn
  Schuss (25.09.2026), nicht aus einer Serie.
- Einen Rekord „meiste Zehner in einer Serie“ gibt es nicht. Er wäre heute 6 · 22.09.2026 · Serie 4 (93 Ringe), also
  mehr als die 94er-Serie.

Dazu kommen vier Rekorde, die auf dem Niveau der Daten mehr sagen als die Zehnerfolge (heute höchstens 4 Schuss):
Zehner und Innenzehner je Serie, die längste Folge ohne Schuss unter 9, der beste schwächste Schuss und die kleinste
Spanne der Serien.

## Approach

Alles im Fachkern nach dem bestehenden Muster: `cardRecordCandidates` rechnet je Scheibe die Kandidaten (gespeichert in
der Projektion, ADR-031), `combineRecords` führt sie zusammen, `recordRows` beschriftet. Bei Gleichstand gilt weiter der
frühere Rekord, Zählungen erst ab einem Treffer.

**Neue Kandidaten** in `RecordCandidates` (`packages/shot-core/src/analysis/records.ts`):

| Feld | Inhalt | Rechnung |
|---|---|---|
| `seriesTens` | `{ length, value, series } \| null`: meiste Zehner in einer Serie voller Länge, bei Gleichstand die frühere | je Serie aus `seriesShots(whole)` mit der Länge `full` (die häufigste, wie `bestSeries`): `computeMetric(TENS, group)`, über `count(...)` (erst ab 1) |
| `seriesInnerTens` | ebenso mit `INNER_TENS` | wie oben |
| `longestNineRun` | `{ length, start } \| null` | `longestRun(whole, scoring, NINE_TENTHS)` mit `NINE_TENTHS = 90`; in ganzen Ringen zählt der Ring (wie bei den Zehnern) |
| `weakestShot` | `{ value, shot } \| null`: der schwächste Wertungsschuss in der Wertung, bei Gleichstand der frühere | über `whole`: `selectShots(whole, { kinds: MATCH, need: valueNeed(scoring) })`; null, wenn einem zählenden Schuss der Wert fehlt (sonst könnte ein schwächerer Schuss verborgen sein); Wert `valueTenths(shot, scoring) / 10`, Nummer aus `shotNumbers(whole)` |
| `seriesSpan` | `number \| null`: Spanne zwischen bester und schwächster Serie voller Länge | `seriesConsistency(whole, scoring)`: `range`, nur wenn es ab zwei Serien gibt und jede Serie voller Länge eine Summe hat (`compared` gleich der Zahl der Serien voller Länge); auf das Raster der Wertung gerundet: `Math.round(range * 10) / 10`, damit 89,3 − 85,4 nicht als 3,8999… gegen 3,9 verliert |

**Neue Rekorde** in `PeriodRecords`:

| Feld | Schlüssel | besser | detail |
|---|---|---|---|
| `mostTensSeries` | Serienlänge | höher | „Serie 4“ |
| `mostInnerTensSeries` | Serienlänge | höher | „Serie 4“ |
| `longestNineRun` | — | höher | „ab Schuss 30“ |
| `bestWeakestShot` | Schusszahl | höher | „Schuss 12“ |
| `smallestSeriesSpan` | Schusszahl | niedriger | — |

**Übergang:** Bis `refreshProjections` beim Serverstart alle Projektionen neu gerechnet hat, lesen die Übersichten alte
Kandidaten ohne die neuen Felder. `combineRecords` liest die neuen Felder deshalb mit `?? null`
(`c.seriesTens ?? null` usw.), damit eine alte Zeile einfach keinen neuen Rekord setzt statt zu werfen.
`PROJECTION_VERSION` 3 → 4.

**Beschriftung** (`packages/shot-ui/src/period/records.ts`), Reihenfolge des Katalogs:

| key | Bezeichnung | Wert |
|---|---|---|
| `R1:k` | `Bestes Ergebnis, Scheibe zu ${k} Schuss` | `353 Ringe` |
| `R2:k` | `Beste Serie zu ${k} Schuss` | `94 Ringe` |
| `R3` | `Bester Teiler` | unverändert |
| `R4s` | `Engste Serie zu 10 Schuss` | unverändert |
| `R4:k` | `Engste Scheibe zu ${k} Schuss` | unverändert |
| `R5:k` | `Meiste 10,9 auf einer Scheibe zu ${k} Schuss` | `1` |
| `R6z:k` | `Meiste Zehner auf einer Scheibe zu ${k} Schuss` | `13` |
| `R6zs:k` (neu) | `Meiste Zehner in einer Serie zu ${k} Schuss` | `6` |
| `R6i:k` | `Meiste Innenzehner auf einer Scheibe zu ${k} Schuss` | `10` |
| `R6is:k` (neu) | `Meiste Innenzehner in einer Serie zu ${k} Schuss` | `3` |
| `R7` | `Längste Zehnerfolge` | `4 Schuss` |
| `R7n` (neu) | `Längste Folge ohne Schuss unter 9` | `11 Schuss` |
| `R8` | `Beste Form (Ø über 5 Scheiben)` | unverändert |
| `R10:k` (neu) | `Bester schwächster Schuss, Scheibe zu ${k} Schuss` | `7 Ringe` bzw. `7,1 Ringe` (`rings`) |
| `R11:k` (neu) | `Kleinste Spanne der Serien, Scheibe zu ${k} Schuss` | `4 Ringe` bzw. `3,9 Ringe` (`rings`) |

Die neuen Bezeichnungen gelten als Textbuch-Eintrag (conventions §10): Mit der Freigabe dieses Plans sind sie
abgenommen.

**Katalog:** R6 und R7 werden erweitert (je Serie, Folge ab 9), R9 bleibt Meilensteine (SP-2.8, offen), neu sind R10
(bester schwächster Schuss) und R11 (kleinste Spanne der Serien).

**Erwartung live** (Luftpistole, ganze Ringe, Probe zählt mit, über alle Scheiben; aus den Schüssen am 17.10.2026
nachgerechnet):

- Meiste Zehner in einer Serie zu 10 Schuss: 6 · 22.09.2026 · Serie 4
- Meiste Innenzehner in einer Serie zu 10 Schuss: 3 · 22.09.2026 · Serie 4
- Längste Folge ohne Schuss unter 9: 11 Schuss · 19.09.2025 · ab Schuss 30
- Bester schwächster Schuss, Scheibe zu 40 Schuss: 7 Ringe · 11.11.2025 · Schuss 12; zu 20: 7 · 22.05.2026 · Schuss 15;
  zu 10: 7 · 25.09.2026 · Schuss 3
- Kleinste Spanne der Serien, Scheibe zu 40 Schuss: 4 Ringe · 18.03.2025; zu 20: 2 Ringe · 22.05.2026
- alle 16 bisherigen Werte unverändert, nur neu beschriftet; dazu 8 neue Zeilen, also „Alle Rekorde (24)“

## Files to change (Implement)

- `packages/shot-core/src/analysis/records.ts`: neue Kandidaten und Rekorde, Konstante `NINE_TENTHS`, Doc-Kommentare
  (R1–R11 ohne R9)
- `packages/shot-core/src/analysis/records.test.ts`: Tests der neuen Rekorde
- `packages/shot-core/src/analysis/projection.ts`: `PROJECTION_VERSION = 4`, Kommentar ergänzt
- `packages/shot-core/src/analysis/projection.test.ts`: Fingerabdruck (`version`, `output`) neu setzen
- `packages/shot-core/src/analysis/catalog.ts`: `periodRecords`, `cardRecordCandidates`, `combineRecords` um R10, R11
- `packages/shot-ui/src/period/records.ts`: Bezeichnungen und neue Zeilen
- `packages/shot-ui/src/period/PeriodTiles.test.tsx`, `packages/shot-ui/src/start/model.test.ts`: neue Bezeichnungen
- `packages/shot-ui/src/period/PeriodInsights.tsx`: Doc-Kommentar „R1–R8“ → „R1–R11“
- `packages/shot-help/src/topics.ts`: Thema `rekorde` (catalog, what, read)
- `vault/spiegel/spiegel-statistics-help.md`: per `pnpm --filter @vereinsheim/shot-help docs` neu geschrieben
- `vault/spiegel/spiegel-statistics.md` §9: Zeilen R6, R7 erweitert, R10 und R11 neu, Absatz über Schlüssel
- `packages/shot-ui/CLAUDE.md`: Zeile `period/records` „R1–R8“ → „R1–R11“

## Required Docs (vor Implementierung lesen)

- `vault/spiegel/spiegel-statistics.md` §9 (Rekorde und Meilensteine)
- `vault/decisions/adr-031.md` (Projektion je Scheibe, Neurechnung über `PROJECTION_VERSION`)
- `vault/conventions.md` §9 (Mutation gegenprüfen, `toBeCloseTo` und `null`) und §10 (So schreiben wir)
- `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`

## Tasks (/implement — je ein fokussierter Commit)

### T1. Fachkern: neue Kandidaten und Rekorde (`records.ts`, `catalog.ts`)

1. Imports ergänzen: `selectShots`, `shotNumbers`, `type ShotKind` (aus `../metrics`), `valueNeed`, `valueTenths`
   (aus `./values`), `seriesConsistency` (aus `./result`); `const MATCH: readonly ShotKind[] = ["match"]` lokal wie in
   `course.ts` und `result.ts`.
2. `const NINE_TENTHS = 90` neben `TEN_TENTHS`, Kommentar „Schwelle eines Neuners in Zehnteln (R7)“.
3. `RecordCandidates` um die fünf Felder aus der Tabelle erweitern, je mit Doc-Kommentar.
4. In `cardRecordCandidates`:
   - in der Schleife über `seriesShots(whole)` zusätzlich, wenn `group.length === full`: `tens = count(computeMetric(TENS,
     group))`, `inner = count(computeMetric(INNER_TENS, group))`; echt größer ersetzt (`>`), so bleibt bei Gleichstand
     die frühere Serie. `full` ist die schon berechnete häufigste Länge aus `seriesCurve`.
   - `longestNineRun` wie `longestTenRun` mit `NINE_TENTHS`.
   - `weakestShot`: `const numbers = shotNumbers(whole)`;
     `const valued = selectShots(whole, { kinds: MATCH, need: valueNeed(scoring) })`;
     null, wenn `valued.length < whole.filter((s) => s.kind === "match").length` oder `valued.length === 0`; sonst der
     Schuss mit dem kleinsten `valueTenths`, bei Gleichstand der mit der kleineren Nummer;
     `{ value: valueTenths(shot, scoring) / 10, shot: numbers.get(shot) }`.
   - `seriesSpan`: `const consistency = seriesConsistency(whole, scoring)`; die Zahl der Serien voller Länge ist
     `curve.filter((s) => s.shots === full).length` (dieselbe Kurve und dieselbe häufigste Länge wie
     `seriesConsistency`); Wert `Math.round(consistency.range * 10) / 10`, wenn `consistency.range !== null` und
     `consistency.compared` gleich dieser Zahl ist, sonst null.
5. `PeriodRecords` um die fünf Felder erweitern; `combineRecords` füllt sie:
   `if (c.seriesTens) put(mostTensSeries, c.seriesTens.length, c.seriesTens.value, "higher", \`Serie ${…}\`)`,
   ebenso Innenzehner; `longestNineRun` wie `longestTenRun`; `put(bestWeakestShot, c.n, c.weakestShot?.value ?? null,
   "higher", …)` mit `detail \`Schuss ${c.weakestShot.shot}\``; `put(smallestSeriesSpan, c.n, c.seriesSpan ?? null,
   "lower")`. Alle neuen Felder mit `?? null` bzw. optionaler Kette lesen (alte Projektionen).
6. Doc-Kommentare der Datei und von `periodRecords` auf R1–R11 (ohne R9) bringen.
7. `catalog.ts`: `periodRecords`, `cardRecordCandidates`, `combineRecords` je `[..., "R8", "R10", "R11"]`.

Test (in `records.test.ts`, neuer Block `describe("Rekorde je Serie, Folge ab 9, schwächster Schuss, Spanne", …)`):

- Zehner je Serie: Scheibe `a` mit 20 Schuss, Serie 1 drei Zehner, Serie 2 fünf; Scheibe `b` (später) mit 40 Schuss
  und höchstens vier je Serie: `mostTensSeries[10]` ist `{ cardId: "a", value: 5, detail: "Serie 2" }`, obwohl `b` mehr
  Zehner auf der Scheibe hat (`mostTens[40]` von `b`). Gleichstand in zwei Serien → „Serie 1“.
- Innenzehner je Serie analog über `tenths ≥ 103`.
- Restserie zählt nicht: 25 Schuss mit fünf Zehnern in Serie 3 (fünf Schuss) → kein Rekord aus Serie 3.
- Folge ab 9: `[95, 90, 100, 89, 91, 92, 93, 94]` → in Zehnteln 4 ab Schuss 5; in ganzen Ringen ebenso (Ring 8 bei
  89 bricht); `[90 × 3]` in Zehnteln 3.
- schwächster Schuss: `a` `[100, 72, 95]`, `b` `[100, 71, 99]` (gleiche Schusszahl) → `bestWeakestShot[3]` von `a`,
  `value` 7,2 in Zehnteln, 7 in ganzen Ringen, `detail: "Schuss 2"`; in ganzen Ringen Gleichstand 7 → der frühere (`a`).
  Fehlt einem Wertungsschuss der Wert (`decimalTenths: null, ring: null`), setzt die Scheibe keinen Rekord.
- Spanne: `a` 20 Schuss mit Serien 90 und 86 → 4; `b` mit 88 und 87 → 1, `smallestSeriesSpan[20]` von `b`; eine
  Scheibe mit einer einzigen vollen Serie setzt keinen; Rundung: Serien 89,3 und 85,4 gegen 3,9 einer früheren
  Scheibe → Gleichstand, die frühere bleibt.
- ohne Treffer kein Rekord für die Zählungen je Serie (Erweiterung des bestehenden Tests „ohne einen Treffer“).
- alte Projektion: `combineRecords` mit einem Kandidaten ohne die fünf neuen Felder (aus `cardRecordCandidates`
  gerechnet, die Felder per Destrukturierung entfernt, `as RecordCandidates`) wirft nicht, setzt die bisherigen
  Rekorde und keinen neuen.
- Gegenprobe per Mutation (conventions §9, Backup per `cp`, nicht `git checkout`): `>` in der Serienschleife durch `>=`
  ersetzen → der Gleichstands-Test wird rot; im schwächsten Schuss die Prüfung auf fehlende Werte entfernen → der Test
  mit fehlendem Wert wird rot; `Math.round` in der Spanne entfernen → der Rundungstest wird rot.

### T2. Projektion neu rechnen (`projection.ts`, `projection.test.ts`)

`PROJECTION_VERSION = 4`, Kommentar: „4: Zehner und Innenzehner je Serie, Folge ab 9, schwächster Schuss, Spanne der
Serien.“ Den Fingerabdruck-Test laufen lassen, die neuen Werte für `version` und `output` eintragen. Die bestehenden
Gleichheitstests `projectedRecords` = `periodRecords` decken die neuen Felder ohne Änderung ab.

Test: `pnpm --filter @vereinsheim/shot-core test`.

### T3. Beschriftung (`shot-ui/period/records.ts`, Tests)

`recordRows` nach der Tabelle oben: `perKey` für `mostTensSeries` (`R6zs`), `mostInnerTensSeries` (`R6is`),
`bestWeakestShot` (`R10`, Wert `rings`), `smallestSeriesSpan` (`R11`, Wert `rings`); `one` für `longestNineRun` (`R7n`,
`${r.value} Schuss`). Reihenfolge: R1, R2, R3, R4s, R4, R5, R6z, R6zs, R6i, R6is, R7, R7n, R8, R10, R11. Kopfkommentar
mit Beispiel auf „Meiste 10,9 auf einer Scheibe zu 20 Schuss: 1“.

Tests: `PeriodTiles.test.tsx` erwartet `label: "Bestes Ergebnis, Scheibe zu 3 Schuss"`; `start/model.test.ts` erwartet
`"Bestes Ergebnis, Scheibe zu 1 Schuss"`. Neu in `PeriodTiles.test.tsx`: Die Keys erscheinen in der Katalogfolge
(Teilfolge `["R1:…", "R2:…", "R3", …, "R11:…"]` der vorhandenen Keys), und keine Bezeichnung enthält mehr `(… Schuss)`.

`PeriodInsights.tsx` Doc-Kommentar „R1–R8“ → „R1–R11“.

### T4. Hilfe und Vault

- `packages/shot-help/src/topics.ts`, Thema `rekorde`: `catalog: ["R1", …, "R8", "R10", "R11"]`; `what` ergänzt um
  „die meisten Zehner und Innenzehner in einer Serie, die längste Folge ohne Schuss unter 9, deinen besten schwächsten
  Schuss und die kleinste Spanne zwischen bester und schwächster Serie“ und den Satz „Ergebnis, engste Scheibe, die Zahl
  der 10,9, Zehner und Innenzehner auf einer Scheibe, der schwächste Schuss und die Spanne der Serien gelten je
  Schusszahl der Scheibe („Scheibe zu 40 Schuss“), die beste Serie und die Zehner einer Serie je Serienlänge („Serie zu
  10 Schuss“).“ Dann `pnpm --filter @vereinsheim/shot-help docs` (schreibt `vault/spiegel/spiegel-statistics-help.md`).
- `vault/spiegel/spiegel-statistics.md` §9: R6 „Meiste Zehner und Innenzehner, je Scheibe und in einer Serie voller
  Länge“; R7 „Längste Zehnerfolge und längste Folge ohne Schuss unter 9“; neu R10 „Bester schwächster Schuss je
  Schusszahl (null, wenn einem Schuss der Wert fehlt)“ (B, SP-2.1, Fachkern); R11 „Kleinste Spanne der Serien voller
  Länge je Schusszahl, ab zwei Serien“ (B, SP-2.1, Fachkern). Im Absatz darüber: „R1, R4 (volle Scheibe), R5, R6 (je
  Scheibe), R10 und R11 je Schusszahl, R2 und R6 (je Serie) je Serienlänge“.
- `packages/shot-ui/CLAUDE.md`: Zeile `period/records` „R1–R8“ → „R1–R11“.
- `/sync-graph` (vault-lint).

## Test steps (nach Implement, committeter Stand)

```bash
pnpm --filter @vereinsheim/shot-core test
```

```bash
pnpm --filter @vereinsheim/shot-ui test
```

```bash
pnpm --filter @vereinsheim/shot-help test
```

```bash
pnpm check
```

## Validate (in `reports/2026-10-17-spiegel-records.md`)

- Dev-Server, eigene Testdaten (`seed:own --demo`, `pruefen`, `seed:own` in einem Befehl, siehe Auto-Memory): im
  Fortschritt „Alle Rekorde“ aufklappen; jede Bezeichnung nach der Tabelle, kein „(… Schuss)“ mehr; auf Start die neuen
  Rekorde des Abends.
- Nach dem Release am Live-System (User angemeldet im Browser-Pane): nach dem Serverstart ist die Projektion neu
  gerechnet (`CardProjection.version` beginnt mit `p4-`); im Fortschritt Luftpistole, ganze Ringe, stehen die Werte aus
  „Erwartung live“, die 16 bisherigen unverändert. Gegenrechnung wie am 17.10.2026 aus dem Schuss-JSON der
  Scheiben-Seiten.
- Was die Dev-Daten nicht hergeben (z. B. Spanne mit Rundung in Zehnteln), steht als „nicht belegt“ mit dem Test, der es
  abdeckt.

## Verification (Erfolgskriterium)

- „Meiste Zehner auf einer Scheibe zu 10 Schuss: 1“ und „Meiste Zehner in einer Serie zu 10 Schuss: 6“ stehen
  getrennt da; keine Bezeichnung lässt offen, ob Scheibe oder Serie gemeint ist.
- Fünf neue Rekorde, gleiche Werte aus Projektion und aus den Schüssen (`projection.test.ts`).
- `pnpm check` grün; Spiegel-Brücke unberührt (kein neues Binary auf dem Pi nötig).

## Zurückgestellt

- R9 Meilensteine (SP-2.8).
- Rekorde aus Probe-Scheiben zu zehn Schuss ganz weglassen: nicht nötig, sobald die Beschriftung „Scheibe zu 10 Schuss“
  sagt; die Option „Trainings nur aus Probe mitzählen“ bleibt der Schalter dafür.
- Bester Abend (gepoolter Ø je Schuss): bei einer Scheibe je Abend gleich dem besten Ergebnis, sagt heute wenig.
