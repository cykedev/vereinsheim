# Plan: SP-1.12 Statistik straffen und Erklärungen berichtigen

- **Datum:** 2026-10-07
- **Branch:** `feat/spiegel-help` (gestapelt auf SP-1.11, ein Review und ein Merge für beide)
- **Roadmap:** neuer Eintrag SP-1.12 in `vault/spiegel/spiegel-roadmap.md`

## 1. Kontext

Wünsche des Users (6./7. Oktober 2026): „den Nutzen der Statistiken genau überprüfen und Redundantes
entfernen. Und noch wichtiger: die Korrektheit der Erklärungen und Hilfen überprüfen.“ Maßstab ist Sa
(entfernt in `d5483f7`): eine Zahl ohne eigene Information, die aus einer anderen folgt.

Drei unabhängige Prüfungen liefen (nur lesend): (1) jede Aussage der Hilfe gegen den Code, (2) jede Zahl
und statistische Behauptung per Simulation mit den echten `shot-core`-Funktionen (20 000 Karten je Fall),
(3) Nutzen und Redundanz aller 33 Auswertungen und 22 Kennzahlen. Stichproben selbst nachgeprüft:

- `cardTrend` mit der stärksten möglichen Stufe (zehnmal Ring 9, dann zehnmal Ring 10) liefert in beiden
  Wertungen `clear: false`; das Sen-Intervall kennt keine Bindungen (`stats.ts:156`), die Untergrenze
  landet auf 0. Exakte Wahrscheinlichkeit dieser Anordnung: 1/C(20,10) = 5,4·10⁻⁶.
- `ringLoss` ist n · 10,9 − Ergebnis, und `ringLossSplit` zerlegt genau diese Summe (`result.ts:115`,
  `position.ts:118`). Der Lage-Anteil zentriert auf den Schwerpunkt derselben Schüsse und ist deshalb zu
  hoch: ohne jeden Versatz im Mittel +0,38 Ringe (LG σ 1,5 mm) bzw. +1,2 (LP σ 15 mm).
- `sighter.offset` nimmt die letzten fünf Probeschüsse ohne Rücksicht auf eine Visierverstellung
  (`metrics.ts:702`), `sighterZeroed` nur die nach der letzten Verstellung.
- Der Streukreis-Wert ist ein Durchmesser (`metrics.ts:489`); R50 lässt Fehlschüsse weg (`:519`), σ nicht.
- Die Richtungsuhr zählt jeden Treffer gleich (`position.ts:181`), der Text spricht von „weiten Schüssen“.

Umfang des Aufräumens: **Stufe 1 + 2** (Empfehlung; der User hat mit „weiter“ bestätigt). Stufe 3 — auf der
einzelnen Scheibe ausblenden, was dort nur Zufall zeigt (Serienschwankung, Ermüdung, Richtungsuhr, Probe
gegen Wertung, Tempo-Streuung, Wiedereinstieg, Quoten über 9,0/10,5, längste Folge) — gehört zur Gestaltung
in SP-1.8; der Code bleibt ohnehin für die Verläufe.

## 2. Entscheidungen

- **E1 Maßstab:** Eine Zahl bleibt nur, wenn sie eine eigene Frage beantwortet und nicht aus einer anderen
  folgt. Katalog-Zeilen entfernter Zahlen bleiben stehen, mit „entfernt (Oktober 2026)“ und Grund; IDs werden
  nie wiederverwendet (wie die SF-Nummern).
- **E2 Stufe 1, exakte Doppelungen:**
  - E9 `ringLoss` entfällt; der Ringverlust steht als `total` in `ringLossSplit` (Lage + Streuung = total).
  - E6 bester/schwächster Schuss entfällt aus `shotExtremes`; es bleiben die drei besten und weitesten
    Teiler (E8), der Parameter `scoring` entfällt.
  - E7 `teilerStats` entfällt (läuft mit Ø je Schuss zu r = −0,998).
  - Z3 `shootingTime` entfällt (Netto-Zeit = Σ Abstände, Schüsse je Stunde = 3600 / Ø Abstand); die Dauer
    bleibt als Registry-Kennzahl `time.duration`.
- **E3 Stufe 2, statistisch klar schwächer:**
  - P3 `group.meanRadius` entfällt (≈ 1,24 · σ̂, nur verrauschter, Effizienz 0,92).
  - P7 `heightWidth`, `group.height`, `group.width` entfallen (Effizienz 0,23–0,43, ein Ausreißer macht die
    Breite 59–87 % größer; die Frage „senkrecht oder waagrecht?“ beantworten P6 und P8).
  - L5 `positionShare` entfällt (dieselbe Aussage wie der Lage-Verlust aus L4, nur in Prozent vom Quadrat).
  - V2 `decimalHistogram` entfällt (40 Schuss auf rund 17 Zehntelwerte: Rauschen).
  - `time.longestPause` entfällt (die Pausen stehen in Z4 und im Rhythmus).
  - L8 `drift`: Ø und größter Sprung entfallen (im Mittel √π · σ), es bleibt das von-Neumann-Verhältnis.
  - V6 `outliers`: das Verhältnis Ø Abstand/R50 entfällt (ohne Grenze, zählt Fehlschüsse anders als R50).
  - V7 `outlierLoss` misst neu, was die **markierten** Ausreißer kosten (E6 unten).
  - S1 `sighter.offset` entfällt aus der Registry und geht in S4 auf (E7 unten).
- **E4 Trend (I3):** Urteil „klar“ über den Mann-Kendall-Test mit Bindungskorrektur und Stetigkeitskorrektur
  (zweiseitig, 95 %); die Zahl ist die Steigung der Ausgleichsgeraden (kleinste Quadrate) je zehn Schuss.
  Das Sen-Intervall entfällt aus `cardTrend` (bei Bindungen entartet, und es widerspräche dem Urteil).
  `cardTrend` liefert `{ n, perTenShots, clear, direction }` mit `direction: "up" | "down" | null`.
  `theilSen` bleibt in `stats.ts` für spätere Verläufe über Scheiben (dort kaum Bindungen).
- **E5 Ringverlust nach Ursache (L4, mit E9):** Zentriert wird jeder Treffer um den Schwerpunkt der
  **übrigen** (Leave-one-out): pᵢ − m₋ᵢ = (pᵢ − m) · n/(n − 1). Der Lage-Verlust schätzt damit, was eine
  Korrektur um den gemessenen Versatz auf neuen Schüssen bringt; ohne echten Versatz ist er im Mittel leicht
  negativ (die Korrektur des Zufalls kostet). Neues Feld `total` = Höchstwert − Ist. Ab 2 Schuss mit Lage.
- **E6 Ausreißer-Kosten (V7):** `outlierLoss(shots, scoring)` = Σ (Median der nicht markierten
  Wertungswerte − vᵢ) über die von `outliers` markierten Wertungsschüsse mit Wert, in Ringen; `count` = Zahl
  der markierten; kein Ausreißer: `loss: 0`. `null`, wenn `outliers` `null` ist. Negativ möglich (ein Ausreißer
  zur Mitte hin bringt Ringe).
- **E7 Probe (S1 in S4):** `sighterZeroed` liefert zusätzlich `matchOffsetUm`: Abstand zwischen dem
  Schwerpunkt der getesteten Probeschüsse (letzte bis zu fünf nach der letzten Verstellung) und dem der
  Wertungsschüsse mit Lage; `null` unter 3 Wertungsschüssen mit Lage. `ANALYSIS_CATALOG.sighterZeroed` =
  `["S1", "S4"]`.
- **E8 P9:** „in Ringbreiten“ ist R50 / W (statt Ø Abstand / W) und steht bei „Maße der Gruppe“.
  `ringWidths` bleibt die allgemeine Umrechnung.
- **E9 Innenzehner-Quote:** entfällt (nur die Anzahl, wie auf dem Ausdruck); die Spielwiese rechnet keine
  Statistik mehr selbst.
- **E10 Katalog-IDs der Registry:** `MetricDefinition.catalogId` (Pflicht, Form `/^[EPLVZISTRCKWQ]\d+$/`). Ein
  Test in `shot-help` verlangt: jede Katalog-ID eines Themas gehört zu einer Auswertung (`ANALYSIS_CATALOG`)
  oder Kennzahl (`METRICS`). Damit fällt eine Erklärung zu einer entfernten Zahl im Gate auf (Lücke aus der
  Nutzen-Prüfung).
- **E11 Belege:** Jede Zahl aus einer Simulation, die in einem Hilfetext steht, erzeugt
  `packages/shot-help/scripts/simulate.ts` reproduzierbar (feste Seeds, echte Funktionen,
  `pnpm --filter @vereinsheim/shot-help simulate`, nicht im Gate). Der Katalog bekommt den Abschnitt
  „Belege aus Simulationen“ mit Methode und Werten; die Texte zitieren nur dort stehende Zahlen.
- **E12 Benennung:** Die Zeile unter der Analyse heißt überall „Datenlage“ (bisher in der Spielwiese
  „Grundlage“); der Reiter heißt „Zeit und Verlauf“.
- **E13 Trefferbild erklärt:** Neue Oberflächen-Hilfe `trefferbild` (`VIEW_HELP`) für die Scheibe, ihre Farben
  und Schalter (Schwerpunkt, Streukreis, Vertrauensellipse, Nummern, Ausschnitt), Glossar-Eintrag
  „Vertrauensellipse“, die Ellipse im Hauptteil von „Ist die Lage echt?“ samt Größenregel (Beleg B16). Anlass:
  Frage des Users am 7. Oktober, die Ellipse stand nur versteckt unter „Was du tun kannst“.

## 3. Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/metrics.ts`, `metrics.test.ts` | `catalogId` je Kennzahl; `group.meanRadius`, `group.height`, `group.width`, `time.longestPause`, `sighter.offset` entfernt |
| `packages/shot-core/src/stats.ts`, `stats.test.ts` | `mannKendall`, `leastSquaresSlope` neu |
| `packages/shot-core/src/analysis/course.ts`, `course.test.ts` | `cardTrend` nach E4 |
| `packages/shot-core/src/analysis/position.ts`, `position.test.ts` | `ringLossSplit` nach E5; `positionShare` entfernt; `drift` ohne Sprünge |
| `packages/shot-core/src/analysis/result.ts`, `result.test.ts` | `ringLoss`, `teilerStats`, `decimalHistogram` entfernt; `shotExtremes` ohne best/worst |
| `packages/shot-core/src/analysis/precision.ts`, `precision.test.ts` | `heightWidth` entfernt; `outliers` ohne `ratio`; `outlierLoss` nach E6 |
| `packages/shot-core/src/analysis/timing.ts`, `timing.test.ts` | `shootingTime` entfernt |
| `packages/shot-core/src/analysis/sighters.ts`, `sighters.test.ts` | `sighterZeroed.matchOffsetUm` |
| `packages/shot-core/src/analysis/catalog.ts`, `catalog.test.ts` | Einträge nach E2–E7 |
| `packages/shot-core/CLAUDE.md` | Exporte, Regel „keine Zahl, die aus einer anderen folgt“ |
| `packages/shot-help/src/topics.ts`, `guide.ts`, `glossary.ts`, `*.test.ts` | Texte nach Anhang A, Themen nach E2/E3/E8, Rückwärtstest E10 |
| `packages/shot-help/scripts/simulate.ts`, `package.json` | Belege nach E11, Skript `simulate` |
| `vault/spiegel/spiegel-statistics.md` | Zeilen nach E1–E9, Abschnitt „Belege aus Simulationen“, Leitbild |
| `vault/spiegel/spiegel-metrics.md`, `spiegel-edge-cases.md`, `spiegel-roadmap.md` | Registry-Liste, SF-60/SF-63, SP-1.12 |
| `vault/spiegel/spiegel-statistics-help.md` | Hauptteil neu erzeugt |

## Required Docs

- `vault/conventions.md` §9 (Mutation, `toBeCloseTo` mit null, Charakterisierungstests)
- `packages/shot-core/CLAUDE.md`, `packages/shot-help/CLAUDE.md`
- `vault/spiegel/spiegel-statistics.md` (Katalog), `vault/spiegel/spiegel-metrics.md` (Registry)
- `plans/2026-10-06-spiegel-help.md` (Aufbau der Hilfe), dieser Plan Anhang A und B

## 4. Tasks

### Task 1: Katalog-IDs der Registry und Rückwärtstest (test-first)

`metrics.test.ts`: „jede Kennzahl trägt ihre Katalog-ID“ mit der erwarteten Zuordnung als Objekt
(`result.rings`/`result.decimal` E1, `result.decimalMean`/`result.ringsMean` E2, `result.tens`/`result.tensRate`
E4, `result.innerTens` E5, `result.bestTeiler` E8, `group.mpiDistance` L2, `group.enclosingDiameter` P1,
`group.meanRadius` P3, `group.r50` P4, `group.sigma` P5, `group.sdX`/`group.sdY` P6, `group.height`/
`group.width` P7, `time.intervalMedian` Z1, `time.tempoSpread` Z2, `time.longestPause` Z4, `time.duration` Z3,
`sighter.offset` S1); `defineMetric` wirft bei falscher Form (Test). Dann Feld `catalogId` in
`MetricDefinition` und je Kennzahl. `topics.test.ts`: „jede Katalog-ID eines Themas gehört zu einer
Auswertung oder Kennzahl“ (Vereinigung aus `Object.values(ANALYSIS_CATALOG)` und `METRICS.map(m => m.catalogId)`).
Commit `feat(shot-core): give every registry metric its catalog ID`.

### Task 2: Trend mit Mann-Kendall (test-first)

`stats.test.ts`: `mannKendall([1, 2, 3])` → S 3, Varianz 66/18, z (3 − 1)/√(66/18); `mannKendall([1, 1, 2, 2])` →
S 4, Varianz (156 − 36)/18, z (4 − 1)/√(120/18); alle gleich → z 0; unter 3 Werten `null`.
`leastSquaresSlope([0, 1, 2], [1, 3, 5])` → 2; gleiche x → `null`. `course.test.ts`: die Stufe zehnmal Ring 9,
zehnmal Ring 10 ist in ganzen Ringen und in Zehnteln `clear: true, direction: "up"` (Test bei `:138–146`
umdrehen); spiegelbildlich `"down"`; 20 gleiche Werte `clear: false, direction: null`; ein einzelner Nuller
am Ende unter 19 Zehnen ist „nicht klar“ (z ≈ −1,56). Dann `mannKendall` (S = Σ sign(yⱼ − yᵢ), Var =
[n(n−1)(2n+5) − Σ t(t−1)(2t+5)]/18, z = (S − sign S)/√Var, bei Var 0 z = 0), `leastSquaresSlope`, `cardTrend`
nach E4. Gegenprobe: ohne Bindungskorrektur in der Varianz wird der Test mit `[1, 1, 2, 2]` rot.
Commit `fix(shot-core): judge the card trend with a tie-aware Mann-Kendall test`.

### Task 3: Ringverlust nach Ursache mit Leave-one-out, E9 darin (test-first)

`position.test.ts`: zwei Schuss bei (1 mm, 0) und (3 mm, 0) auf LG: zentriert liegen beide bei 2 mm
(je `scoreFromCoordinates` im Test), `positionLoss` = zentriert − Ist; immer `total = positionLoss +
spreadLoss` (ganze Ringe und Zehntel); ein Schuss → `null`; eine exakt symmetrisch um die Mitte liegende
Gruppe hat `positionLoss ≤ 0`; eine um 10 mm versetzte enge Gruppe `positionLoss > 0`. Kleine Simulation im
Test (Seed, 300 Karten, 40 Schuss, LG σ 1,5 mm, zentriert): mittlerer Lage-Verlust < 0. Gegenprobe: Faktor
n/(n − 1) durch 1 ersetzt → Simulationstest rot. Dann `ringLossSplit` nach E5 mit `total`; `ringLoss`
entfernen (Code, Tests, Katalog `ringLossSplit: ["E9", "L4"]`).
Commit `fix(shot-core): estimate the position loss out of sample`.

### Task 4: Ausreißer ohne Verhältnis, Kosten der markierten (test-first)

`precision.test.ts`: `outliers` hat die Schlüssel `n, flagged` (kein `ratio`); `outlierLoss`: Karte mit
einem markierten Schuss vom Wert 7,0 unter Werten um 10,2 → `count 1`, `loss` = Median der übrigen − 7,0;
ohne Ausreißer `count 0, loss 0`; ein markierter Schuss zur Mitte hin mit höherem Wert → `loss < 0`; unter
5 Schuss mit Lage `null`. Dann Code nach E6; `outliers` nur über Wertungsschüsse aufrufen.
Commit `feat(shot-core): cost the flagged outliers instead of the weakest tenth`.

### Task 5: Probe-Versatz in „Eingeschossen?“ (test-first)

`sighters.test.ts`: Verstellung nach P2 von 8, Wertung versetzt → `matchOffsetUm` aus P4–P8 gegen die
Wertung; Verstellung nach P8 von 10 → `null` (nur P9, P10); unter 3 Wertungsschüssen mit Lage
`matchOffsetUm: null`, der Test selbst bleibt. Dann Code nach E7, Katalog `["S1", "S4"]`.
Commit `feat(shot-core): measure the sighter offset after the last adjustment`.

### Task 6: Entfernen in den Auswertungen

`decimalHistogram`, `teilerStats`, best/worst aus `shotExtremes` (ohne `scoring`), `shootingTime`,
`positionShare`, `heightWidth`, Sprünge aus `drift`. Tests der Funktionen löschen bzw. anpassen; Katalog
(`shotExtremes: ["E8"]`, Zeilen der entfernten Funktionen weg); `catalog.test.ts` hält die Menge gleich.
Damit Rückwärtstest und Synchron-Test grün bleiben, im selben Commit die Zuordnung in `shot-help`: Themen
`zehntelverteilung` und `lageanteil` entfernen, `extreme-und-teiler` auf `catalog: ["E8"]`; Leitfaden neu
erzeugen (die Texte folgen in Task 9). `shot-core/CLAUDE.md`: Exporttabelle, Regel aus E1. Commit `refactor(shot-core): drop analyses that repeat
other numbers`.

### Task 7: Entfernen in der Registry

`group.meanRadius`, `group.height`, `group.width`, `time.longestPause`, `sighter.offset` raus. Tests, die den
mittleren Radius als Beispiel einer Lage-Kennzahl nutzen (`metrics.test.ts:47, 107, 118–120, 143, 205`), auf
`group.sigma` umstellen; Tests zu SF-63 für `sighter.offset` in `sighters.test.ts` überführen (Task 5).
Im selben Commit die Zuordnung in `shot-help`: `masse-der-gruppe` ohne P3, P7 und die drei Kennzahlen,
`pausen` und `eingeschossen` ohne Kennzahl; Leitfaden neu erzeugen.
Commit `refactor(shot-core): drop registry metrics that repeat other numbers`.

### Task 8: Belege per Simulation

`packages/shot-help/scripts/simulate.ts` (per Write-Werkzeug), Skript `"simulate": "tsx scripts/simulate.ts"`.
Eigener PRNG (mulberry32 + Box-Muller, fester Seed je Fall), Lagen auf ganze µm, Wertung über
`scoreFromCoordinates`, nur echte Funktionen. Gibt je Beleg Name, Fall und Wert aus (Liste in Anhang B).
Laufzeit unter zwei Minuten (Wiederholungen je Fall 5 000, beim Mehrfachtest 20 000). Kein Test im Gate;
`tsc` prüft das Skript. Commit `feat(shot-help): reproduce every simulated number in the help`.

### Task 9: Hilfetexte

Nach Anhang A: Themen `zehntelverteilung` und `lageanteil` entfernen (23 Themen), Zuordnungen nach E2/E3/E8,
alle Textkorrekturen, `VIEW_HELP` `trefferbild` und Glossar „Vertrauensellipse“ (E13); Werte aus Task 8 einsetzen (Mehrfachtest: Anteil p → „etwa jede k. ganz normale
Scheibe“ mit k = Rundung von 1/p). Tests: Themenzahl, Lookup (`helpForMetric("group.meanRadius")` jetzt
`undefined`), Rückwärtstest grün. Leitfaden neu erzeugen. Commit `fix(shot-help): correct the explanations
after the review`.

### Task 10: Katalog und Doku

`spiegel-statistics.md`: Zeilen E5, E6, E7, E9, P3, P7, P9, L4, L5, L8, V2, V7, Z3, Z4, I3, S1 nach E1–E9;
Abschnitt „Belege aus Simulationen“ (Methode, Werte aus Task 8, Aufruf); Leitbild „Viel, aber geordnet“ um
„und nichts doppelt“ ergänzen. `spiegel-metrics.md` (Registry-Liste, Feld `catalog`), `spiegel-edge-cases.md`
(SF-60, SF-63 auf die neuen Stellen), Roadmap SP-1.12 (Ziel, Umfang, Abnahme, Status). `vault-lint`.
Commit `docs(spiegel): record what the statistics review removed and why`.

## 5. Test steps

1. `pnpm --filter @vereinsheim/shot-core test`, `pnpm --filter @vereinsheim/shot-help test` grün; `pnpm check`
   und `pnpm check --force` grün.
2. Gegenproben (Mutation, je rot): Bindungskorrektur weg (Task 2); n/(n − 1) durch 1 (Task 3); Ausreißer-Kosten
   über die schwächsten 10 % statt die markierten (Task 4); Verstellung in `matchOffsetUm` ignoriert (Task 5);
   eine Katalog-ID eines Themas auf eine entfernte Auswertung gesetzt (Task 1).
3. `pnpm --filter @vereinsheim/shot-help simulate` läuft durch; die Werte stimmen mit Katalog und Texten.

## 6. Verification

1. Gate gecacht und ungecacht, Testzahlen, `vault-lint`.
2. Mutationsprobe wie Test step 2.
3. Spielwiese: entfernte Karten und Zeilen weg, Trend mit Richtung ohne Intervall, Ringverlust aus
   `ringLossSplit.total`, Ausreißer-Kosten, Probe-Versatz aus S4, R50 in Ringbreiten, keine Innenzehner-Quote,
   „Datenlage“, „Was heißt das?“ unter den Schaltern der Scheibe (`trefferbild`); Skriptprüfung angepasst und grün, Gegenprobe der Skriptprüfung, Sichtprüfung dunkel und 390 px.
4. Keine Datei außerhalb der Tabelle in §3 geändert (`git diff --stat`).
5. Abnahme: Leseprobe durch den User.

## Anhang A: Texte (endgültig)

Nicht genannte Felder bleiben. „Entfällt“ heißt: Feld leer lassen.

**ergebnis** — `what`: „Das Ergebnis ist die Summe aller Wertungsschüsse, der Ø der Durchschnitt je Schuss.
Probeschüsse zählen nicht mit.“ `read`: bisheriger Text + „Was dir zum Höchstwert fehlt, zeigt
„Ringverlust nach Ursache“.“ `caution`: „Fehlt einem Schuss der Wert, gibt es kein Ergebnis: Eine Summe über
einen Teil der Schüsse wäre keins. Den Ø gibt es trotzdem, über die Schüsse mit Wert.“ `formula`:
„Ergebnis = Σ vᵢ (Zehntel) bzw. Σ Ringᵢ; Ø = Σ vᵢ / n über die Schüsse mit Wert“.

**extreme-und-teiler** — `title` „Beste und weiteste Teiler“, `catalog` E8. `short`: „Deine drei besten und
drei weitesten Treffer, gemessen am Teiler.“ `what`: „Die drei kleinsten und die drei größten Teiler mit
Schussnummer, wie auf dem Meyton-Ausdruck. Der kleinste Teiler ist dein bester Schuss, der größte dein
schwächster.“ `read`: „Der Teiler misst feiner als der Wert: Zwei Schüsse mit 10,9 unterscheiden sich im
Teiler noch. Bei gleichem Teiler nennt Spiegel den früheren Schuss.“ `caution`: „Ein verdächtiger Schuss
(Platzhalter, Handeintrag) zählt hier nicht: Er trägt nur den amtlichen Wert, nicht deine Leistung. Der beste
Teiler wird mit mehr Schüssen besser; vergleiche ihn nur bei gleicher Schusszahl.“ `minimum`: „Ab 1 Schuss mit
Lage.“

**serien-und-konstanz** — `catalog` E10, I1. `what`: „Das Ergebnis jeder Serie, wie stark die Serien schwanken
(Standardabweichung, Spanne) und wie stark ein einzelner Schuss typischerweise schwankt (MAD).“ `read`: „Kleine
Spanne heißt gleichmäßig. Die Spanne wächst aber mit der Zahl der Serien; Scheiben mit verschieden vielen
Serien vergleichst du über die Standardabweichung. Verglichen werden nur Serien der häufigsten Länge; fehlt
einem Schuss der Wert, hat seine Serie keine Summe.“ `act`: „Fällt eine Serie ab, sieh im Reiter „Zeit und
Verlauf“ nach, ob davor eine Pause lag („Pausen und Wiedereinstieg“) oder ob es zum Ende hin nachlässt
(„Ermüdung“).“ `caution`: „Wie gleichmäßig du wirklich schießt, zeigt erst der Vergleich über mehrere
Scheiben.“ `formula`: „SD und Spanne der Serien gleicher Länge; MAD = Median |vᵢ − Median v|“.

**quoten** — `what`: „Der Anteil deiner Schüsse ab einer Schwelle (Zehner, ab 9,0, ab 10,5) mit
95-%-Bereich, dazu die Zahl deiner Zehner und Innenzehner und die längste Folge ab 10,0.“ `read`: „Der Punkt
ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich liegt. Bei 40 Schuss ist er noch breit:
Bei 20 Treffern von 40 reicht er etwa von 35 % bis 65 %.“ `caution`: „Liegen die Balken zweier Abende nicht
übereinander, ist der Unterschied echt. Überlappen sie sich nur ein Stück, kann er trotzdem echt sein; liegt
der Punkt des einen Abends im Balken des anderen, ist er nicht belegt. Innenzehner von Gewehr und Pistole sind
nicht vergleichbar, und die längste Folge wird mit mehr Schüssen länger. In ganzen Ringen erreicht eine
Schwelle über 10,0 keiner.“

**praezision-sigma** — `catalog` P5. `read`: „Kleiner ist besser. σ hängt kaum von der Schusszahl ab und ist
deshalb das richtige Maß, um einen Abend mit 20 Schuss mit einem mit 40 zu vergleichen.“ `caution`: „Bei 10
Schuss reicht der 95-%-Bereich von etwa einem Viertel darunter bis knapp die Hälfte darüber; bei stark
gestreckten Gruppen ist er etwas zu schmal. Ein Fehlschuss zählt bei σ mit und kann es vervielfachen; R50
lässt ihn weg.“ `formula`: „σ̂ = √(Σ rᵢ² / (2(n − 1))) / c4(2n − 1); 95-%-Bereich über χ² mit 2(n − 1)
Freiheitsgraden“.

**masse-der-gruppe** — `catalog` P1, P4, P6, P9; `metrics` `group.enclosingDiameter`, `group.r50`,
`group.sdX`, `group.sdY`. `short`: „Streukreis, R50 und die Streuung waagrecht und senkrecht.“ `what`: „Der
Streukreis ist der kleinste Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein Durchmesser. R50
ist der Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt, ohne Fehlschüsse. Streuung x und y
sind die typischen Abweichungen waagrecht und senkrecht.“ `read`: „R50 stören einzelne weite Schüsse kaum. In
Ringbreiten (Luftgewehr 2,5 mm, Luftpistole 8 mm) heißt ein R50 von 0,5: Die Hälfte deiner Treffer liegt
innerhalb einer halben Ringbreite um den Schwerpunkt; so lassen sich Gewehr und Pistole grob vergleichen. Ist
die Streuung y deutlich größer als x, streust du vor allem senkrecht; ob das mehr als Zufall ist, sagt die
Karte „Form der Gruppe“.“ `caution`: „Der Streukreis wird mit jedem weiteren Schuss größer oder bleibt gleich:
Über 40 Schuss ist er bei gleicher Präzision im Mittel rund {Streukreis 10→40} größer als über 10. R50 fällt
bei wenigen Schüssen etwas zu klein aus, bei 10 Schuss um etwa {R50 bei 10}. Ein Fehlschuss bläht Streukreis
und Streuung auf, R50 nicht. Abende mit unterschiedlicher Schusszahl vergleichst du über σ.“ `formula`:
„Streukreis = Durchmesser des kleinsten umschließenden Kreises (Welzl); R50 = Median der rᵢ ohne Fehlschüsse;
Streuung mit n − 1; in Ringbreiten: R50 / W“. (Werte in {…} aus Task 8, Belege B3/B4.)

**form-der-gruppe** — `minimum`: „Ab 3 Schuss; den Winkel zeigt Spiegel nur bei einer gestreckten Gruppe ab 10
Schuss.“

**ausreisser** — `short`: „Schüsse, die nicht zur Gruppe passen, und was sie dich kosten.“ `what`: „Spiegel
prüft die Lage jedes Treffers gegen die übrigen: Liegt er weiter von ihrem Schwerpunkt weg, als ihre Streuung
erwarten lässt? Bei einer ganz normalen, runden Gruppe meldet die Regel nur in 5 % der Scheiben fälschlich
einen Ausreißer. Ist die Gruppe deutlich gestreckt (a/b um 2), passiert das öfter, umso öfter, je mehr Schüsse
die Scheibe hat: bei 10 Schuss in etwa {B2 n=10}, bei 60 Schuss in etwa {B2 n=60} der Scheiben.“ `read`: „Ein
markierter Schuss ist ein Kandidat für die Frage „Was war da los?“ und bleibt in der Wertung. Darunter steht,
wie viele Ringe die markierten Schüsse gegenüber deinem typischen Schuss (Median) gekostet haben.“ `act`:
„Kosten dich Ausreißer über mehrere Scheiben viele Ringe, lohnt die Arbeit an einem gleichmäßigen Ablauf mehr
als an der Präzision.“ `caution`: „Ein Ausreißer liegt weit von deiner Gruppe, nicht unbedingt weit von der
Mitte: Liegt die Gruppe neben der Mitte, kann er sogar Ringe bringen. Zwei gleich weite Ausreißer können sich
bei wenigen Schüssen gegenseitig verdecken: Bei 10 Schuss findet die Regel einen einzelnen sehr weiten Schuss
fast immer, von zwei gleich weiten meist keinen.“ `minimum`: „Ab 5 Schuss mit Lage.“ `formula`: „T = d² / (2S²
(1 + 1/(n − 1))) gegen das (1 − 0,05/n)-Quantil von F(2, 2(n − 2)); Kosten = Σ (Median der übrigen − vᵢ) über
die markierten Schüsse“.

**lage-echt** — `what`: „Der Schwerpunkt ist der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß
geviertelte Kreis. Er ist selbst nur geschätzt: Die Vertrauensellipse zeigt, wo dein wahrer Schwerpunkt mit großer
Sicherheit liegt. Ein Test (Hotelling) prüft, ob der Versatz zur Mitte mehr als Zufall ist; er sagt dasselbe wie die
Ellipse: Liegt die Mitte darin, ist der Versatz nicht belegt.“ `read`: „Die Lage steht als Abstand und Richtung zur
Mitte da, etwa 0,72 mm, davon 0,6 mm rechts und 0,4 mm tief. „Echt versetzt“: Eine Korrektur an Visier oder Anschlag
kann sich lohnen. „Vom Zufall nicht zu unterscheiden“: nicht am Visier drehen, auch wenn der Schwerpunkt neben der
Mitte liegt. Die Ellipse hat die Form deiner Gruppe und schrumpft mit der Schusszahl: Ihre Halbachse ist bei 10
Schuss etwa so groß wie deine Streuung σ, bei 40 Schuss etwa 0,4 σ. Sie zeigt nicht, wo deine Schüsse liegen, nur
wo ihr Mittelpunkt liegen kann.“ `act`: „Ist die Lage echt versetzt, zeigt „Ringverlust nach Ursache“, wie viele
Ringe eine Korrektur etwa bringt.“

**ringverlust-nach-ursache** — `catalog` E9, L4. `short`: „Wie viele Ringe dir zum Höchstwert fehlen und wie
viele davon eine Korrektur der Lage brächte.“ `what`: „Dein Ringverlust ist, was dir zum Höchstwert fehlt (10
je Schuss, in Zehnteln 10,9). Spiegel teilt ihn auf: Jeder Treffer wird um den Schwerpunkt der übrigen
Schüsse verschoben und neu gewertet. Was das bringt, ist der Verlust durch die Lage, der Rest der Verlust
durch die Streuung.“ `read`: „Großer Lage-Anteil: Visier oder Anschlag. Großer Streuungs-Anteil: Präzision.
Der Ringverlust ist die Zahl, die du kleiner machen willst; er wächst mit der Schusszahl.“ `caution`: „Ohne
echten Versatz ist der Lage-Anteil meist leicht negativ: Eine Korrektur würde dann Ringe kosten. Belastbar
erst ab 10 Schuss, wenn die Lage echt ist und die Korrektur etwas bringt. Gerechnet wird nur mit Schüssen mit
Lage, aus der Lage neu gewertet; die Summe kann deshalb vom Ergebnis abweichen. Nie amtlich.“ `minimum`: „Ab 2
Schuss mit Lage, belastbar ab 10.“ `formula`: „Ringverlust = n · 10,9 − Σ vᵢ bzw. n · 10 − Σ Ringᵢ; zentriert:
(pᵢ − m) · n/(n − 1), jeder Treffer um den Schwerpunkt der übrigen verschoben; Lage = zentriert − Ist;
Streuung = Höchstwert − zentriert“.

**richtungsuhr** — `read`: „Um die Mitte zeigt sie, wohin deine Treffer gehen; um den Schwerpunkt, in welche
Richtungen deine Gruppe streut, etwa vor allem nach oben und unten. Jeder Treffer zählt gleich, ein weiter so
viel wie ein naher.“ `caution`: „Erst ab 30 Schuss mehr als ein Bild, und auch dann schwankt sie stark: Bei 30
Schuss hat der stärkste Keil zufällig meist {B13} so viele Treffer wie der Schnitt. Ein Befund ist erst, was
sich über mehrere Scheiben wiederholt.“

**drift-und-wanderung** — `what`: „Ob die Sprünge von Schuss zu Schuss zu deiner Streuung passen
(von-Neumann-Verhältnis) und wie der Schwerpunkt von Serie zu Serie wandert.“ `read`: „Sind deine Schüsse
unabhängig voneinander, liegt die Zahl um 2. Deutlich darunter wandert die Gruppe langsam, etwa weil sich der
Anschlag im Lauf des Abends verändert.“ `caution`: „Spiegel urteilt hier nicht: Auch ohne jedes Wandern liegt
die Zahl zufällig bei 10 Schuss etwa zwischen {B8 n=10} und bei 40 Schuss zwischen {B8 n=40}.“ `minimum`: „Ab 3
Schuss mit Lage, die Wanderung ab 2 Serien mit je 2 Schuss mit Lage.“ `formula`: „von Neumann = (Σ Sprung² / k)
/ (Σ rᵢ² / (n − 1)) mit k Sprüngen; um 2 bei unabhängigen Schüssen“.

**verlauf-und-trend** — `what`: „Jeder Punkt ist ein Schuss, die Linie der Schnitt der letzten zehn
(gestrichelt, solange es noch keine zehn sind). Der Trend ist eine Ausgleichsgerade durch alle Schüsse; die
Zahl sagt, wie viele Ringe du je 10 Schuss zulegst oder verlierst.“ `read`: „„Klar fallend“ heißt: Ein so
deutlicher Abfall entstünde durch Zufall allein höchstens in 5 von 100 Scheiben; „klar steigend“ gilt ebenso
nach oben. Sonst ist der Trend „nicht klar“, auch wenn die Linie etwas fällt oder steigt.“ `caution`: „Selbst
ein deutliches Nachlassen zeigt eine einzelne Scheibe selten als „klar“. In ganzen Ringen ist ein Trend etwas
seltener klar, weil Feinheiten verloren gehen.“ `minimum`: „Ab 1 Schuss, der Trend ab 10.“ `formula`:
„gleitender Schnitt über die letzten 10; Trend: Steigung der Ausgleichsgeraden je 10 Schuss; „klar“ nach
Mann-Kendall mit Korrektur für gleiche Werte (95 %)“.

**tempo-und-dauer** — `what`: bisheriger Text, letzter Satz „Dazu die Dauer vom ersten bis zum letzten
Schuss.“ `formula`: „Tempo = Median der Abstände ohne Pausen über 180 s; Tempo-Streuung = Q3 − Q1 der
Abstände; Dauer = letzter − erster Schuss“.

**pausen** — `metrics` leer. `short`: „Deine Pausen und wie viele Ringe die Schüsse danach brachten.“ `what`:
„Jede Pause über drei Minuten und ob die bis zu drei Wertungsschüsse danach im Schnitt mehr oder weniger Ringe
brachten als deine übrigen Schüsse.“ `caution`: „Drei Schüsse sind wenig: Auch wenn die Pause nichts ausmacht,
liegen sie zufällig bis zu etwa {B10 LG} (Luftgewehr, σ 1,5 mm) bzw. {B10 LP} (Luftpistole, σ 15 mm) je Schuss
neben deinem Schnitt. Ob dir Pausen schaden, zeigt erst der Vergleich über mehrere Abende.“ `formula`: „Pause =
Abstand über 180 s; Wiedereinstieg = Ø der bis zu 3 Schüsse danach − Ø der übrigen“.

**ermuedung** — `read` neu: „Ein Minus beim Wert oder ein Plus bei R50 heißt: am Ende schwächer.“ `caution`:
„Eine einzelne Scheibe ist verrauscht: Auch ohne jede Ermüdung unterscheiden sich die ersten und die letzten
zehn zufällig um bis zu etwa {B9 LG} Ringe je Schuss (Luftgewehr, σ 1,5 mm) bzw. {B9 LP} (Luftpistole, σ 15
mm), R50 um bis zu {B9 R50}. Ein Muster wird es erst, wenn es auf mehreren Scheiben so ist.“ `minimum`: „Ab 20
Wertungsschüssen mit Wert, R50 ab 20 mit Lage ohne Fehlschüsse.“

**serien-im-vergleich** — `read`: „Wandert der Schwerpunkt der Serien deutlich in eine Richtung, ändert sich
etwas im Anschlag.“ `caution` neu: „Auch ohne jede Veränderung liegt der Schwerpunkt einer Zehnerserie im
Mittel etwa {B12} neben dem der Scheibe, und R50 einer Serie schwankt stark.“ `minimum`: „R50 ab 5 Schuss in
der Serie, der Versatz ab 2.“

**probe-umfang** — `what`: „Wie viele Probeschüsse du vor dem ersten Wertungsschuss abgegeben hast, auch in
Blöcken zu zehn, wie lange die Probe dauerte und wie viel Zeit vom ersten Probeschuss bis zum ersten
Wertungsschuss verging.“

**probe-gegen-wertung** — `read`: „σ ist der fairere Vergleich: R50 fällt bei wenigen Schüssen etwas zu klein
aus, und die Probe hat meist weniger Schüsse.“ `caution`: „Ein Fehlschuss zählt bei σ mit und bläht es auf;
R50 lässt ihn weg. Mit wenigen Probeschüssen ist auch σ unsicher: Bei gleicher Präzision liegt σ aus fünf
Probeschüssen zufällig zwischen etwa {B11}.“

**eingeschossen** — `metrics` leer. `what`: „Ein Test deiner letzten fünf Probeschüsse vor der Wertung, nach
der letzten Visierverstellung: Lagen sie echt neben der Mitte? Dazu der Abstand zwischen ihrem Schwerpunkt und
dem der Wertung.“ `caution`: „„Kein Versatz nachweisbar“ heißt nicht „eingeschossen“: Fünf Schüsse erkennen
nur einen deutlichen Versatz. Selbst ein Versatz so groß wie zweimal deine Streuung σ fällt nur in etwa {B7}
der Fälle auf.“ `minimum`: „Ab 3 Probeschüssen mit Lage nach der letzten Visierverstellung, der Abstand zur
Wertung zusätzlich ab 3 Wertungsschüssen mit Lage.“ `formula`: „Hotelling-T² über die letzten fünf
Probeschüsse nach der letzten Verstellung; Versatz = |m Probe − m Wertung|“.

**datenlage** — `read`: „Je mehr fehlt, desto weniger tragen die Zahlen. Ein Schuss ohne Lage fehlt bei
Streuung und Lage, ohne Zeit bei Tempo und Rhythmus. Fehlt einem Wertungsschuss der Wert, gibt es kein
Ergebnis und keine Summe seiner Serie; Ø und Quoten rechnen ohne ihn. Ein verdächtiger Schuss zählt nur mit
seinem Wert, auch wenn er eine Lage oder Zeit hat.“ `caution` neu: „In Zehnteln fehlt beim Ergebnis auch ein
Schuss, der nur einen ganzen Ring hat.“

**Einstieg** — „Schusszahl n“: „die Zeile „Datenlage“ unter der Analyse“ statt „Grundlage“. „95-%-Bereich“:
Beispiel „„σ 1,12 mm, 95 %: 0,94 bis 1,36 mm“ heißt bei 30 Schuss: Dein wahrer Wert liegt mit großer
Sicherheit in diesem Bereich.“, Rest bleibt. „„Echt“ und „unklar““: „„Echt“ heißt: Reiner Zufall brächte ein
so deutliches Ergebnis nur in 5 von 100 Fällen. Weil auf einer Scheibe mehrere Tests laufen, zeigt trotzdem
etwa jede {B1}. ganz normale Scheibe irgendwo ein „echt“, „gestreckt“, „klar“ oder einen Ausreißer. „Unklar“
heißt nicht „gibt es nicht“, sondern: Diese Schüsse reichen nicht, um es zu zeigen oder auszuschließen. Mehr
Schüsse oder mehrere Scheiben klären es. Auf den Karten heißt das auch „nicht klar“, „vom Zufall nicht zu
unterscheiden“ oder „kein Versatz nachweisbar“; es ist ein ehrliches Ergebnis, kein Fehler.“ „Ganze Ringe oder
Zehntel“: „… deshalb ist ein Trend dort etwas seltener „klar“ …“. „Probe und Wertung“: „Lage, Streuung und Tempo
der Analyse rechnen über die Wertung. Die Probe hat einen eigenen Reiter. Nach einer Visierverstellung zählt
bei „Probe gegen Wertung“ und „Eingeschossen?“ nur die Probe danach; der Umfang der Probe zählt alle
Probeschüsse.“

**Trefferbild** (neu, `VIEW_HELP`, id `trefferbild`) — `what`: „Jeder Treffer in Kalibergröße, gefärbt nach seinem Ring:
10 rot, 9 gold, 8 türkis, 7 und weniger violett. Probeschüsse sind hohl. Die Treffer sind leicht durchscheinend,
damit du siehst, wo sie sich überlagern.“ `read`: „Die Schalter blenden ein: den Schwerpunkt (kleiner schwarz-weiß
geviertelter Kreis, der Mittelpunkt deiner Treffer), den Streukreis (blauer Ring um alle Treffer; seine Zahl misst
Mitte zu Mitte), die Vertrauensellipse (gestrichelt: wo dein wahrer Schwerpunkt mit großer Sicherheit liegt; liegt
die Mitte darin, ist ein Versatz nicht belegt) und die Schussnummern. „Gruppe“ zoomt auf deine Treffer, „Scheibe“
zeigt die ganze Scheibe.“

**Beobachtungen in Worten** — `read`: „„Echt“ oder „klar“ steht nur, wenn ein Test es zeigt: Reiner Zufall
brächte das nur in 5 von 100 Fällen. Sonst sagt der Satz ehrlich, dass die Schüsse nicht reichen. Weil mehrere
Tests laufen, trifft es bei etwa jeder {B1}. ganz normalen Scheibe einmal zufällig zu.“

**Fehlschlüsse** — „Eine Scheibe ist kein Muster“: „Was eine Scheibe zeigt, gilt für diesen Abend. Ob
Ermüdung, Pausen oder ein Abfall dich regelmäßig betreffen, zeigt erst der Vergleich über mehrere Scheiben.“
„Mehr Schüsse, größerer Streukreis“: „Bei gleicher Präzision ist der Streukreis über 40 Schuss im Mittel rund
{B3} größer als über 10. Wer so vergleicht, vergleicht vor allem die Schusszahl. Für Vergleiche σ nehmen.“
„„Unklar“ ist ein Ergebnis“: „Es sagt: Diese Schüsse zeigen nichts, was über den Zufall hinausgeht. Vielleicht
gibt es nichts, vielleicht ist es für diese Schusszahl zu klein. Wer trotzdem am Visier dreht, korrigiert oft
den Zufall und verliert dabei im Mittel Ringe.“ „Nach einem Rekord …“: „Das ist meist Statistik (Regression zur
Mitte) und für sich kein Zeichen von Formverlust.“

**Glossar** — Streukreis: „Kleinster Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein
Durchmesser. Meyton druckt einen „Trefferkreis“; ob er genau dasselbe misst, prüft Spiegel noch an
Rohdaten.“ R50: „… ohne Fehlschüsse.“ von-Neumann-Verhältnis: „Vergleicht die Sprünge von Schuss zu Schuss mit
der Streuung; bei unabhängigen Schüssen liegt es um 2.“ Theil-Sen entfällt (nicht mehr auf der Scheibe). Neu:
„Vertrauensellipse: Bereich um den gemessenen Schwerpunkt, in dem der wahre Schwerpunkt mit großer Sicherheit (95 %)
liegt. Liegt die Scheibenmitte darin, ist ein Versatz nicht belegt. Sie schrumpft mit der Schusszahl, die Gruppe
nicht.“ „Mann-Kendall-Test: Prüft, ob die Werte über die Scheibe eher steigen oder fallen, und kommt mit vielen
gleichen Werten zurecht.“ „Fehlschuss: Ein Nuller oder ein Treffer weit außen, in den Daten markiert; R50 lässt
ihn weg, die übrigen Maße zählen ihn mit.“ „Verdächtiger Schuss: Platzhalter oder Handeintrag; er zählt nur mit
seinem amtlichen Wert, nie mit Lage, Teiler oder Zeit.“

## Anhang B: Belege (Task 8 erzeugt sie, der Katalog nennt sie)

| Nr | Fall | Erwartung aus der Prüfung |
|---|---|---|
| B1 | normale Scheibe (rund, zentriert, ohne Trend, 5 Probe + 20/40/60 Wertung, LG σ 1,5 mm): Anteil mit mindestens einem Befund (Lage echt, gestreckt, Ausreißer, Trend klar, Probe echt) — nach dem Trend-Fix neu | vorher 18–19 % |
| B2 | Ausreißer-Fehlalarm rund und a/b 2 bei 10/20/40/60 Schuss | 5 %; 11,3 / 14,2 / 17,3 / 19,6 % |
| B3 | Streukreis 40 gegen 10 Schuss, gleiche Präzision | +31 % |
| B4 | R50 bei 10 Schuss gegen den Grenzwert | −3,9 % |
| B5 | Lage-Verlust (L4, neu) ohne Versatz, 40 Schuss, LG σ 1,5 mm und LP σ 15 mm; mit Versatz 0,5σ: angezeigt gegen Gewinn auf einer neuen Scheibe | Mittel < 0; angezeigt ≈ Gewinn |
| B6 | Trend (I3, neu): Fehlalarm ohne Trend in Zehnteln und ganzen Ringen, Trennschärfe bei Nachlassen (σ +60 % über die Scheibe), 20/40 Schuss | ≈ 5 %; ganze Ringe etwas unter Zehnteln |
| B7 | Hotelling mit 5 Probeschüssen, Versatz 2σ | 63–64 % |
| B8 | von Neumann ohne Wandern, 95-%-Spanne bei 10 und 40 Schuss | 1,19–2,81; 1,56–2,43 |
| B9 | Ermüdung ohne Effekt, 95-%-Spanne Δ Ø (LG σ 1,5 mm, LP σ 15 mm) und Δ R50 | ±0,35; ±1,1; ±57 % |
| B10 | Wiedereinstieg ohne Effekt, 95-%-Spanne | ±0,5; ±1,5 |
| B11 | σ aus 5 Probe- gegen 40 Wertungsschüsse, gleiche Präzision, 95-%-Spanne des Verhältnisses | 0,53–1,59 |
| B12 | Versatz des Schwerpunkts einer Zehnerserie zur Scheibe, 40 Schuss, ohne Drift | 0,34σ |
| B13 | Richtungsuhr um den Schwerpunkt, 30 Schuss: stärkster Keil im Median gegen den Schnitt | ×2,0 |
| B14 | Ausreißer bei 10 Schuss: ein Schuss bei 5σ erkannt; von zwei bei 5σ mindestens einer | 88,8 %; 13,9 % |
| B16 | deterministisch aus `mpiConfidence`: Halbachse der Vertrauensellipse relativ zur Streuung je Richtung bei 5/10/20/40/60 Schuss | 2,26 / 1,00 / 0,61 / 0,41 / 0,33 |
| B15 | deterministisch: Wilson 20/40; σ-Bereich bei 10, 30 (σ̂ 1,12 mm), 120 Schuss | 35,2–64,8 %; −25,5/+45,8 %; 0,94–1,36 mm; −8,3/+9,8 % |

Die Texte runden die erzeugten Werte („etwa“, „rund“); weicht ein Wert spürbar von der Erwartung ab,
gilt der erzeugte, und Anhang A wird angepasst.
