# Plan: Statistik-Katalog und SP-1.10 Fachkern: Analyse einer Scheibe

- **Anlass:** Wunsch des Users vom 6. Oktober 2026: „ich will statistiken, viele verschiedene. alles was
  sinnvoll ist“ und „ein super nützliches profi tool …, mit denen ich systematisch trainieren kann und
  mit dem ich analysieren kann“; dazu „plane die guten und sinnvollen statistik features. was da jetzt
  bereits möglich ist bitte bauen und in die spielwiese integrieren“.
- **Grundlage:** Recherche (Treffsicher, Spiegel-Konzept, Meyton ESTA 5 und Ballistic Manager, DISAG,
  Kongsberg, SIUS, SCATT, ShotAnalyzer, Ring Reader, TargetScan, Ballistic X, Literatur): 99
  Kennzahlen in 13 Themen.
- **Branch:** `feat/spiegel-statistik` (auf `feat/spiegel-meyton-pdf`, damit beide per fast-forward
  nach `main` gehen)
- **Datum:** 2026-10-06

## 1. Context (warum)

Spiegel soll ein Profi-Werkzeug werden, mit dem man systematisch trainiert und analysiert. Heute rechnet
`shot-core` 16 Kennzahlen. Die Recherche liefert einen Katalog dessen, was sinnvoll ist, und zeigt, was
mit unseren Daten nicht geht (Zielverlauf, Abzug, Körper). Zwei Ergebnisse:

1. **Planen:** der Katalog als Vault-Notiz mit Priorität und Zuordnung zur Roadmap; die Roadmap bekommt
   SP-1.10 (Analyse einer Scheibe, jetzt) und erweitert Phase 2 (Verläufe, Vergleiche, Erkenntnisse über
   Zeiträume, Training mit Messdaten).
2. **Bauen, was jetzt geht:** Alles, was **eine Scheibe** hergibt, braucht keine Datenbank und keine
   Historie. Es kommt als reine Funktionen nach `shot-core` (Modul `analysis`) und in die Spielwiese.
   Zeitraum-Statistiken (Verläufe, Rekorde, Bedingungen) brauchen gespeicherte Scheiben und folgen mit
   SP-2.x.

**Abgrenzung (ADR-026, `spiegel-vision`):** Treffsicher besitzt das Tagebuch: Absicht, Reflexion,
Befinden und Ziele. „Systematisch trainieren“ plant dieser Plan deshalb auf der Messdaten-Seite:
Auswertungen, Übungen mit messbarem Kriterium und ehrliche Aussagen. Ziele bleiben in Treffsicher, bis
der User die Grenze anders zieht (Frage an den User, nicht Teil der Umsetzung).

## 2. Entscheidungen

- **E1 Katalog im Vault:** neue Notiz `vault/spiegel/spiegel-statistics.md` mit allen sinnvollen
  Kennzahlen, je Thema, mit ID (E, P, L, V, Z, I, S, T, R, C, K, W, Q), Kurzdefinition, Priorität
  (A/B/C), Roadmap-Zuordnung und Status. Dazu die Regeln für ehrliche Zahlen, die Liste des Unmöglichen,
  Beispielsätze und die Quellen. `spiegel-metrics` bleibt die Notiz zur Registry.
- **E2 Jetzt gebaut:** alle Kennzahlen der Ebenen Schuss, Serie und Scheibe mit Priorität A und die
  sinnvollen B (Liste in Task 3–8). Nicht jetzt: alles mit Zeitraum (T, R, C3–C7, K, W, I7, I8, Z6, Z7,
  L7, L9, L10), dazu P10 (Modell), L11 (braucht Visier-Daten) und Z8 (braucht Zeitlimits).
- **E3 Struktur:** reine Statistik-Hilfen in `src/stats.ts`; die Auswertungen als Modul
  `src/analysis/` (je Thema eine Datei, `index.ts` bündelt), Export `./analysis` und `./stats`.
  Rückgaben sind Objekte mit `n` und den Werten, `null` unter der Mindestzahl (SF-61). Skalare, die sich
  für Verläufe eignen, kommen zusätzlich in die Registry (Task 9).
- **E4 Auswahl wie die Registry:** Die Auswertungen nutzen dieselben Regeln wie `computeMetric`
  (gültige Angaben, verdächtige Schüsse nur mit Wert, Abgabefolge `seq`). Dafür exportiert `metrics.ts`
  `selectShots(shots, { kinds, need, excludeMisses })`, und `computeMetric` nutzt es selbst.
- **E5 Ehrlichkeit eingebaut:** Unsicherheit dort, wo sie geschlossen und exakt rechenbar ist:
  Quoten mit Wilson-Intervall; Rayleigh-σ mit χ²-Intervall (gerade Freiheitsgrade, geschlossene
  Verteilungsfunktion, Quantil per Bisektion); Lage per Hotelling-T² mit F(2, n−2) (geschlossenes
  Quantil); Trend per Theil-Sen mit Sen-Intervall. Aussagen wie „echt“ nur, wenn die Grenze überschritten
  ist; sonst „zufällig“ oder „unklar“.
- **E6 Präzisionsmaß für Verläufe:** σ̂ = Sa / c4(2n − 1) mit Sa = √(Σrᵢ² / (2(n − 1))) ist kaum
  n-abhängig und bekommt eine Kennzahl (`group.sigma`). Mittlerer Radius und R50 schrumpfen im
  Erwartungswert mit √((n − 1)/n) und werden als `nSensitive` markiert (Befund der Recherche).
- **E7 Ringverlust nach Ursache (L4):** Lagen um −Schwerpunkt verschieben und mit `scoring.ts` neu
  werten (eine Scheibe nötig); Lageverlust und Streuungsverlust in Zehnteln und ganzen Ringen.
  `reliable` nur ab 10 Schuss und wenn die Lage laut Hotelling echt ist; die Werte sind nie amtlich.
- **E8 Spielwiese** (außerhalb des Repos, Teil der Validierung): Bereich „Analyse“ mit allen neuen
  Auswertungen, Diagrammen (Histogramm, Richtungsuhr, gleitender Schnitt, Rhythmus, Wasserfall),
  Vertrauensellipse auf der Scheibe, Beispielscheiben mit 40 Wertungsschüssen und Probe (erfunden,
  reproduzierbar), Probe-Modus beim Tippen und „Beobachtungen in Worten“ nach den Regeln des Katalogs.

## 3. Dateien

Neu:

- `vault/spiegel/spiegel-statistics.md`
- `packages/shot-core/src/stats.ts` + `stats.test.ts`
- `packages/shot-core/src/analysis/{result,precision,position,timing,course,sighters,coverage,index}.ts`
  + je `*.test.ts` (außer `index.ts`)

Geändert:

- `packages/shot-core/src/metrics.ts` + `metrics.test.ts` (`selectShots`, neue Kennzahlen, `nSensitive`)
- `packages/shot-core/package.json` (Exporte `./stats`, `./analysis`), `packages/shot-core/CLAUDE.md`
- `vault/spiegel/spiegel-roadmap.md`, `vault/spiegel/spiegel-vision.md`, `vault/spiegel/spiegel-metrics.md`,
  `vault/spiegel/spiegel.md` (Hub-Verweis)

## Required Docs

- `vault/conventions.md` (§9: Mutation, `toBeCloseTo` und null, Charakterisierungstests)
- `vault/spiegel/spiegel-metrics.md`, `vault/spiegel/spiegel-edge-cases.md` (SF-01, SF-07, SF-14, SF-15,
  SF-30, SF-60–SF-63), `vault/spiegel/spiegel-vision.md`, `vault/decisions/adr-026.md`
- `packages/shot-core/CLAUDE.md`, `packages/shot-core/src/metrics.ts`, `geometry.ts`, `time.ts`,
  `scoring.ts`
- Recherche-Ergebnis (in diesem Plan zusammengefasst; Quellenliste geht in die Katalog-Notiz)

## 4. Tasks

### Task 1: Katalog und Roadmap (Doku)

- `vault/spiegel/spiegel-statistics.md` (type `concept`, `part_of: [[spiegel]]`, `relates_to:
  [[spiegel-metrics]], [[spiegel-ui-design]], [[spiegel-edge-cases]], [[spiegel-vision]],
  [[statistics-visualization]]`): Abschnitte „Leitbild“, „Was es schon gibt“ (Spiegel, Treffsicher,
  Meyton, fremde Werkzeuge), „Katalog“ (13 Themen, jede Kennzahl eine Zeile: ID, Name, Definition,
  Ebene, Priorität, Roadmap, Status), „Mit unseren Daten nicht möglich“, „Ehrliche Zahlen“,
  „Beobachtungen in Worten“, „Quellen“ (geöffnete URLs).
- `spiegel-roadmap.md`: neues **SP-1.10 Fachkern: Analyse einer Scheibe** (Ziel, Umfang = Task 2–9,
  Abnahme, hängt ab von SP-1.2); SP-1.8 bekommt den Bereich „Analyse“ der Session-Ansicht; SP-2.1 und
  SP-2.2 nennen die Katalog-IDs; neu **SP-2.7 Erkenntnisse über Zeiträume** (I7, I8, Z6, Z7, L7, L9,
  L10, K1–K5, W1–W6, T3, T4) und **SP-2.8 Training mit Messdaten** (Übungen mit Kriterium wie „Bleib
  drüber“, Soll-Schnitt, Zehntel-Ziel, längste Folge; Ziele bleiben laut ADR-026 in Treffsicher).
- `spiegel-vision.md`: Leitbild „Profi-Werkzeug zum systematischen Trainieren und Analysieren“.
- `spiegel.md`: Verweis auf den Katalog.
- vault-lint, Gate, Commit `docs(spiegel): add the statistics catalog and plan the analysis`.

### Task 2: Statistik-Hilfen (`stats.ts`, test-first)

```ts
export function quantile(values: readonly number[], p: number): number | null   // Typ 7, sortiert intern
export function median(values: readonly number[]): number | null
export function mad(values: readonly number[]): number | null                   // Median der |x − Median|
export function iqr(values: readonly number[]): number | null
export function wilson(successes: number, n: number, z?: number): { low: number; high: number } | null
export function logGamma(x: number): number                                       // Lanczos, x > 0
export function c4(n: number): number                                             // n ≥ 2
export function chiSquareCdfEven(x: number, df: number): number                   // df gerade
export function chiSquareQuantileEven(p: number, df: number): number              // Bisektion
export function fQuantile2(p: number, nu: number): number                         // F(2, ν), geschlossen
export function theilSen(xs: readonly number[], ys: readonly number[], z?: number):
  { slope: number; intercept: number; low: number; high: number } | null           // ab 3 Punkten
```

Tests mit Tabellenwerten: χ² df 2: 0,0506/7,3778; df 10: 3,2470/20,4832; df 20: 9,5908/34,1696;
F(2;2) 19,000, F(2;3) 9,5521, F(2;10) 4,1028; c4(2) 0,79788, c4(10) 0,97266; lnΓ(5) = ln 24, lnΓ(0,5) =
ln √π; Wilson 8/10 → [0,4902; 0,9433], 0/10 → [0; 0,2775]; Quantil, Median, MAD, IQR an kleinen
Listen (gerade und ungerade); Theil-Sen auf y = 2x + 1 (Steigung 2, Intervall [2; 2]) und mit einem
Ausreißer (Steigung bleibt 2). Commit `feat(shot-core): add statistics helpers`.

### Task 3: Auswahl teilen (`selectShots`)

`metrics.ts` exportiert `selectShots(shots, { kinds?, need?, excludeMisses? })` mit denselben Regeln wie
`counts` + `satisfies`; `computeMetric`/`eligibleShots` nutzen es. Test: gleiche Ergebnisse wie
`eligibleShots` für jede Kennzahl auf `CARD` mit Fehlschuss und Platzhalter. Commit mit Task 4.

### Task 4: Ergebnis (`analysis/result.ts`, test-first)

- `ringDistribution(shots)` → `{ n, counts: number[11] (Ring 0…10), innerTens }` (V1), nur Wertung.
- `decimalHistogram(shots)` → Zählung je Zehntel 0…109 (V2).
- `shotExtremes(shots)` → bester und schwächster Schuss mit Abgabe-Nummer (E6), die drei besten und drei
  weitesten Teiler mit Nummer (E8); verdächtige Schüsse ausgenommen.
- `teilerStats(shots)` → Mittel und Median des Teilers (E7).
- `ringLoss(shots)` → `{ rings: n·10 − ΣRing, tenths: n·10,9 − ΣWert }` (E9).
- `seriesConsistency(shots)` → Serien-Ergebnisse (gleiche Länge), SD, Spanne, MAD der Schusswerte (E10).
- `shareAtLeast(shots, tenths)` → Anzahl, n, Quote, Wilson (E4 als Quote der Zehner, E11 für 10,0+).
Tests mit festen Werten auf dem Ausdruck vom 2. Oktober (`MATCH` aus `metrics.test.ts` als gemeinsame
Fixture `src/__fixtures__/cards.ts`).

### Task 5: Präzision (`analysis/precision.ts`, test-first)

- `sigmaEstimate(points)` → `{ n, sa, sigma (σ̂ mit c4), low, high }` (P5), ab 3 Punkten. Test `SPREAD`:
  Sa 2,0 mm, σ̂ 2,0505, Intervall [1,3974; 3,5099].
- `heightWidth(points)` → Höhe, Breite, (H + B)/2 (P7). `SPREAD`: 5, 7, 6.
- `groupShape(points)` → Halbachsen, Verhältnis, Winkel, `showAngle` (ab 10 Punkten und Verhältnis über
  1,3) (P8). `SPREAD`: a √5,2, b √2,8, Verhältnis 1,3628, Winkel 0.
- `ringWidths(meanRadiusMm, target)` → MR / Ringbreite (P9).
- `outliers(points)` → Indizes mit r > Q3 + 1,5·IQR, Verhältnis MR/R50 (V6); `SPREAD`: MR/R50 0,9333.
- `outlierLoss(values)` → Σ(Median − v) über die schwächsten 10 % (V7), ab 10 Werten.

### Task 6: Lage (`analysis/position.ts`, test-first)

- `mpiConfidence(points)` → Schwerpunkt, T², kritischer Wert `2(n−1)/(n−2) · F₀,₉₅(2, n−2)`, `real`
  (Lage echt), Halbachsen und Winkel der 95-%-Ellipse (L3), ab 3 Punkten. Tests: symmetrisch um 0 →
  T² 0, nicht echt; vier Punkte um (2 | 0) → T² 24, kritisch 3·19 = 57, nicht echt; zehn Punkte eng um
  (2 | 0) → echt.
- `ringLossSplit(shots, target)` → Ist, zentriert, Lage- und Streuungsverlust in Zehnteln und Ringen,
  `reliable` (L4). Test LP: zehn Schuss eng um (5 | 0) mm → Ist 10,3 je Schuss, zentriert 10,9,
  Lageverlust 6,0 Zehntel, in Ringen 0.
- `positionShare(points)` → Lageanteil am mittleren quadratischen Abstand, Schätzrauschen abgezogen
  (L5); `SPREAD` 0.
- `directionClock(points, center?)` → zwölf Zählungen nach Uhrzeit (12 oben, 3 rechts) (L6); `SPREAD`
  um die Mitte: 12 → 1, 3 → 1, 6 → 2, 9 → 2.
- `drift(pointsInOrder)` → Ø und größter Sprung, von-Neumann-Verhältnis (L8); `SPREAD`: Σ Sprung² 64,
  Σr² 40 → 1,6; Ø 3,2485; größter 5.

### Task 7: Zeit (`analysis/timing.ts`) und Verlauf (`analysis/course.ts`), test-first

- `tempoSpread(shots)` → IQR und relativer IQR der Intervalle ohne Pausen (Z2).
- `shootingTime(shots)` → Dauer (null nach Uhrsprung), Netto-Zeit, Schüsse je Stunde (Z3).
- `pauseRecovery(shots)` → je Pause Ø der drei Folgeschüsse gegen den Scheiben-Ø (Z4).
- `rhythmProfile(shots, window = 5)` → gleitender Median der Intervalle je Schuss (Z5).
- `seriesCurve(shots)` → Serien-Ergebnisse in Ringen und Zehnteln (I1).
- `fatigue(shots)` → Ø der letzten zehn minus Ø der ersten zehn, R50 ebenso (I2), ab 20 Schuss.
- `cardTrend(shots)` → Theil-Sen-Steigung in Zehnteln je zehn Schuss mit Intervall, `clear` nur, wenn
  das Intervall die 0 ausschließt (I3).
- `movingAverage(shots, window = 10)` → je Schuss Ø der letzten bis zu zehn, mit `partial` (I4).
- `seriesSpread(shots)` → R50 je Serie (I5); `mpiPath(shots)` → Schwerpunkt je Serie und Abstand zum
  Scheiben-Schwerpunkt (I6); `longestRun(shots, tenths)` → längste Folge ab Schwelle mit Start (I10).

### Task 8: Probe und Datenlage (`analysis/sighters.ts`, `analysis/coverage.ts`), test-first

- `sighterSummary(shots)` → Zahl, Blöcke à zehn, Dauer, Zeit bis zum ersten Wertungsschuss (S2).
- `sighterComparison(shots, { adjustAfter? })` → Probe (nach der letzten Verstellung) gegen Wertung:
  Ø je Schuss und R50 (S3).
- `sighterZeroed(shots)` → `mpiConfidence` der letzten fünf Probeschüsse vor der Wertung (S4).
- `dataCoverage(shots)` → Wertung, Probe, ohne Lage, ohne Zeit, Merkmale (Q1).
- `analysis/index.ts` exportiert alles; `package.json` bekommt `./analysis` und `./stats`.

### Task 9: Registry

- Neu: `group.sigma` (σ̂, mm, 2 Stellen, ab 3, nicht n-abhängig), `group.height`, `group.width` (mm,
  1 Stelle, ab 3, n-abhängig), `result.tensRate` (Zehnerquote, wertungsfrei, `needs: "ring"`),
  `time.tempoSpread` (IQR in s, ab 4), `time.duration` (Dauer in s, Ebene Scheibe).
- `group.meanRadius` und `group.r50`: `nSensitive: true`; Test „hängen von der Schusszahl ab“ angepasst.
- `SCORING_FREE` im Paar-Test um `result.tensRate`.
- Tests mit festen Werten (`SPREAD`, `MATCH`).

### Task 10: Doku

`packages/shot-core/CLAUDE.md` (Exporte `./stats`, `./analysis`; Regeln: Auswertungen nutzen
`selectShots`, Unsicherheit statt Scheingenauigkeit), `spiegel-metrics` „Umsetzung“ (neue Kennzahlen,
`nSensitive`), Katalog-Status auf „gebaut“ für SP-1.10, Roadmap SP-1.10 erledigt. vault-lint, Gate,
Commit `docs(spiegel): document the analysis of a card`.

## 5. Verification

1. `pnpm check` grün; Zahl der Tests.
2. Mutationsprobe: Wilson ohne Korrektur (Normalnäherung); χ²-Quantil mit falschem Freiheitsgrad;
   F-Quantil mit (1−p) statt p; c4 weggelassen; Hotelling mit n statt n−1; Ringverlust ohne Neuwertung;
   Richtungsuhr gegen den Uhrzeigersinn; von Neumann ohne Quadrat; Ermüdung erste minus letzte; Theil-Sen
   als Mittel statt Median; gleitender Schnitt ohne Teilfenster; `selectShots` ohne Platzhalter-Regel.
3. Spielwiese: Bereich „Analyse“ mit Beispielscheiben (LG 40, LP 40, je mit Probe und Pause) und
   Probe-Modus; Skriptprüfung der Werte gegen `shot-core`; Sichtprüfung hell, dunkel, 390 px.
4. `git diff` nur `packages/shot-core`, Vault-Notizen, Plan.

## Nachtrag 1: Wertung in den Auswertungen (Validierung, 6. Oktober 2026)

Beim Einbau in die Spielwiese fiel auf, dass elf Auswertungen nur in Zehnteln rechneten; die Vorgabe
„ganze Ringe und Zehntel immer umschaltbar“ galt bisher nur für die Registry. Seitdem nehmen
`shotExtremes`, `seriesConsistency`, `shareAtLeast`, `outlierLoss`, `seriesCurve`, `fatigue`,
`cardTrend`, `movingAverage`, `longestRun`, `pauseRecovery` und `sighterComparison` die Wertung als
Pflichtparameter (`analysis/values.ts`). Schwellen bleiben in Zehnteln; in ganzen Ringen zählt Ring 10
als 100: Eine Schwelle über 10,0 erreicht dann keiner, 9,5 erreicht jede 10. Ohne Zehntel (SF-18) gibt es die
Auswertung nur in ganzen Ringen. Die Ergebnisse heißen wertungsneutral (`value`, `total` in Ringen).
Ein Test hält fest, dass derselbe Anstieg in ganzen Ringen zur Stufe wird und der Trend dann nicht
mehr „klar“ ist.

## Nachtrag 2: Review-Befunde, Hilfe und Doku (6. Oktober 2026)

Review: `reports/2026-10-06-spiegel-statistik-review.md` (neun Major, elf Minor). Der statistische
Kern ist bestätigt; die Fixes betreffen Auswahl, Nummern, zwei Kennzahlen, die Formanzeige und Tests.
Signaturen danach (alle in `packages/shot-core`, test-first, je Befund ein Test, der ohne den Fix rot
ist):

- `shotNumbers(shots)` (neu, `metrics.ts`): Nummer jedes Schusses in der Abgabefolge seiner Art
  (Wertung ab 1, Probe ab 1) über alle gegebenen Schüsse, unabhängig von fehlenden Angaben. Alle
  Nummern in `analysis/*` kommen daher: `shotExtremes`, `movingAverage`, `longestRun`, `cardTrend`
  (x-Werte), `pauseRecovery.afterShot`, `rhythmProfile` (mit `kind`), `outliers`.
- `shotExtremes(shots, scoring)`: bester und schwächster ohne verdächtige Schüsse (SF-15, E6); bei
  gleichem weitestem Teiler der frühere zuerst.
- `seriesCurve(shots, scoring)` → `{ series, shots, total: number | null }`: `shots` zählt alle
  Wertungsschüsse der Serie, `total` ist null, wenn einem der Wert fehlt (wie `result.*`).
  `seriesConsistency` vergleicht nur vollständige Serien der häufigsten Länge.
- `outliers(shots)` → `{ n, flagged: { shot, number }[], ratio }`, ab 5 Schuss: jeder Schuss gegen den
  Schwerpunkt der übrigen, T = d²/(2S²(1 + 1/(n − 1))) gegen das (1 − 0,05/n)-Quantil von F(2, 2(n − 2)) (Bonferroni)
  (simuliert: Fehlalarm 5 %, 5σ-Schuss zu 89–100 % erkannt). Ersetzt Q3 + 1,5 · IQR (Fehlalarm bis
  47 %).
- `groupShape(shots)` → zusätzlich `sphericity` (Mauchly, W = 4a²b²/(a² + b²)²) und `elongated`
  (W < 0,05^(2/(n − 2)), exakt); `showAngle = elongated && n ≥ 10`; ohne Ausdehnung null.
- `heightWidth` ab 3 Schuss wie die Registry.
- `mpiConfidence`: kollinear auch mit Rundungsrest (relative Schwelle) → null.
- `ringLossSplit`: Summen `{ decimal, rings }`; `reliable` nur mit Lagegewinn > 0 in Zehnteln und ≥ 0 in
  ganzen Ringen.
- `directionClock` → zusätzlich `reliable` (ab 30 Schuss, Katalog L6).
- `drift`: von Neumann je Sprung normiert, (Σ Sprung²/k)/(Σ r²/(n − 1)); Lücken über `shotSteps`.
- `shootingTime.shotsPerHour` = Intervalle je Netto-Stunde.
- `pauseRecovery(shots, scoring)`: Wiedereinstieg gegen den Ø der übrigen Schüsse.
- `sighterSummary`: Probe nur bis zum ersten Wertungsschuss, Zeiten über `selectShots`, Dauer über
  `tempo` (null nach Uhrsprung), negative Abstände null.
- `sighterComparison` → je Seite `n`, `valued`, `positioned`, `meanRings`, `r50Um`, `sigmaUm`.
- `sighterZeroed(shots, { adjustAfter })`: erst Lage auswählen, dann die letzten fünf nach der letzten
  Verstellung; mit Ellipse.
- `stats`: nicht endliche Werte → RangeError; Theil-Sen ohne 95-%-Bereich (unter sechs Punkten) → null;
  Fenster ab 1.

**Hilfe und Doku** (Wunsch des Users: „ich verstehe nicht alle, gute Dokumentation und Hilfe, auch in
der Anwendung, das ist wichtig“):

- Vault-Leitfaden `vault/spiegel/spiegel-statistics-help.md`: jede Auswertung in einfacher Sprache
  (was sie misst, wie man sie liest, was man tun kann, typische Fehlschlüsse), dazu „So liest du die
  Zahlen“ (n, 95 %, echt/unklar, ganze Ringe/Zehntel).
- Roadmap: neues Feature **SP-1.11 Hilfe und Erklärungen** (Erklärtexte als eine Quelle für App und
  Doku, „?“ an jeder Zahl, Glossar, Einstieg); SP-1.8 hängt davon ab. `spiegel-ui-design` bekommt den
  Abschnitt „Hilfe und Erklärungen“.
- Spielwiese: „Was heißt das?“ an jeder Analyse-Karte, Karte „So liest du die Analyse“ im Überblick.

## Nachtrag 3: Nachprüfung des Reviews (6. Oktober 2026)

Der Reviewer hat die Fixes nachgerechnet (Fuzz über 4000 Zufallskarten ohne Ausnahme, Registry und
Analyse stimmen überein) und hält den Branch für merge-reif. Drei neue Minor-Punkte, alle umgesetzt:

- **N1 Reihenfolge und Nummern:** Fehlen einem Schuss Abgabefolge und Zeit, ordnet `shotNumbers` die
  Karte nach der Liste, die Auswertungen ordneten ihre Auswahl aber nach `seq`. Jetzt ordnen alle
  Auswertungen erst die ganze Karte und wählen dann aus; Abstände kommen aus `stepsInOrder` und
  `timesInOrder` (neu in `metrics.ts`, ohne neues Sortieren). Die Registry bleibt, wie sie ist, sie nennt
  keine Nummern.
- **N2 Ausreißer bei gestreckten Gruppen:** Die 5 % Fehlalarm gelten für runde Gruppen; bei gestreckten
  steigt die Rate (eigene Simulation: a/b 1,5 etwa 8–11 %, a/b 2 etwa 11–19 %, a/b 3 etwa 17–29 %). In
  Code-Kommentar, Katalog V6, Hilfe und Spielwiese benannt; ein affiner Test für gestreckte Gruppen ist
  als Verbesserung vermerkt.
- **N3 sechs Tests** für die Grenzen (F-Freiheitsgrade, Zweig ohne Streuung der übrigen, Mauchly-Exponent
  und -Irrtum, Ringe in der Belastbarkeit, Schwelle der Richtungsuhr). Mutationsprobe danach 71 von 71.

## Nachtrag 4: Rückmeldung des Users nach dem Merge (6. Oktober 2026)

- **„Gestreckt tritt erst sehr spät auf“:** Simulation (je 20 000 Läufe) bestätigt den Test: Eine runde
  Gruppe zeigt zufällig a/b 1,32 (20 Schuss) bzw. 1,21 (40 Schuss); die 95-%-Grenze liegt bei 1,81 bzw.
  1,50; eine echte Streckung von 1,3 erkennt eine Scheibe mit 40 Schuss in 28 %, über 120 Schuss in 72 %.
  Neu: `groupShape` nennt `ratioLimit`, das a/b, ab dem die Gruppe bei dieser Schusszahl gestreckt ist,
  damit die Oberfläche „a/b 1,35 · gestreckt ab 1,50“ zeigen kann. Die Form über mehrere Scheiben geht
  nach SP-2.7 (L9). Die Beispielscheibe der Spielwiese war rund erzeugt und bekommt eine realistische
  senkrechte Streckung.
- **„Ausreißer nicht mehr als rote Punkte“:** richtig so, die Beispielscheiben enthalten keinen echten
  Ausreißer (die alte Regel markierte zwei fälschlich). Die Luftpistolen-Scheibe der Spielwiese bekommt
  einen echten Abreißer.
- **Overlays über den Treffern:** Streukreis, Vertrauensellipse und Schwerpunkt liegen über den Schüssen,
  mit hellem Saum (Zeichenregel in `spiegel-ui-design`).
