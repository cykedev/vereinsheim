# Plan: Zahlen über einen Zeitraum auf Basis der Schüsse (ADR-034)

Branch `feat/period-shot-basis` (Worktree `.claude/worktrees/period-shot-basis`, von `main` bei `dad67542`).

## Context (warum)

Am 22. Oktober 2026 hat der User das Visier seiner Luftpistole nach dem Trefferbild verstellt. Spiegel sagte bei 30 und
90 Tagen „Deine Lage passt“, bei 6 und 12 Monaten „versetzt: hoch, im Mittel 2,1 mm“. Der geviertelte Kreis stand in
allen vier Bildern gleich, gut 2 mm hoch. Ursache ist die Regel „Einheit ist die Scheibe“:

- Eine Scheibe mit 10 Schuss zählt so viel wie eine mit 40. Zwei kurze, tief liegende Scheiben zogen das Mittel der
  Mitten auf 2,2 mm, die Mitte aller Schüsse lag bei 2,9 mm.
- Hotelling über 7 bis 11 Mitten schätzt die Unsicherheit aus diesen wenigen Punkten. Die Grenze liegt bei 7 Scheiben
  bei 13,9, bei 11 bei 9,5. Das Urteil kippte mit zwei Scheiben mehr.

Die Bestandsaufnahme (alle Zahlen über einen Zeitraum) zeigt dieselbe Regel in Ø je Schuss (E2; der Katalog sagt Σ über
die Schüsse, der Code mittelt die Scheiben), Zehnerquote (E4), Streuung (P5, P6, zwei verschiedene Werte in Kachel und
Präzision), Lage (L10, C3), Schnitt der fünf davor (T1, Liste, Start), beste Form (R8). Die Simulationen B19, B25, B28
kannten nur Scheiben zu 40 Schuss und kein Wandern der Abende.

Nachgerechnet an den Daten des Users (Dev-Kopie bis 16. Oktober, Skripte im Scratchpad der Sitzung): Streuung je Schuss
x 13, y 11 mm. In der Höhe wandern die Abende nicht über den Zufall hinaus (Einweg-Varianzanalyse p 50 bis 71 %),
seitlich schon (2,4 bis 3,2 mm, p 0,2 bis 5 %). Über zwei Ebenen gerechnet ist die Lage in allen vier Zeiträumen
versetzt (p 0,5 bis 3,3 %), hoch 2,7 bis 2,9 mm bei 30 und 90 Tagen.

## Entscheidung (ADR-034)

Werte über die Schüsse, Urteile über Schüsse und Abende, je Scheibe bleibt, was Scheiben zeigt. Wortlaut und Begründung:
[`vault/decisions/adr-034.md`](../vault/decisions/adr-034.md), Status `Proposed`. Mit der Freigabe dieses Plans setzt
die Hauptsitzung sie vor `/implement` auf `Accepted` (der Autopilot darf `vault/decisions/` nicht ändern).

Entschieden mit diesem Plan (zur Freigabe):

1. **Vortest α 0,25** („sometimes pool“, Bancroft 1964): Zeigt er kein Wandern, zählen alle Schüsse als eine
   Stichprobe (N − 1 Freiheitsgrade). Sonst zählt jeder Abend (k − 1), mit dem Mittel über die Schüsse und seiner
   Varianz für ungleiche Schusszahlen.
2. **Tempo (Z1) bleibt das Mittel je Scheibe:** Mediane lassen sich nicht zusammenführen. Richtig ginge es nur mit allen
   Abständen in der Projektion; das ist nicht Teil dieses Plans.
3. **Je Scheibe bleiben:** Punkte im Verlauf, Formband (MAD der Abweichungen einzelner Scheiben), Boden und Decke der
   Monate (P10/P90 der Scheiben), Rekorde einer Scheibe, beste Scheibe in der Box, „bedeutsam“ (T3: 0,3 × Streuung
   der Scheibenwerte, Hopkins misst die Schwankung von Wettkampf zu Wettkampf).
4. **Treffsichers Einheiten ohne Einzelschüsse** haben keine Streuung der Schusswerte: Wert über die Schüsse, Urteil
   weiter Mann-Whitney über die Einheiten (`basis: "cards"`).
5. **Ein Urteil ab fünf Scheiben** (je Seite) wie bisher; für die Lage zählen Scheiben ab drei Schuss mit Lage, gerechnet
   wird über alle gezeichneten Schüsse dieser Scheiben.
6. **Abnahme durch Simulation:** Fehlalarm höchstens 6,5 % in jeder Zelle, höchstens 5,5 % ohne Wandern. Sonst
   Circuit-Breaker (siehe unten).

## Approach

Ein neues Modul im Fachkern rechnet über zwei Ebenen (Schüsse in Scheiben). Jede Kennzahl sagt in der Registry, wie sie
über Schüsse zusammengeht (`pooling`), und für Mittel, wie ein Schuss zählt (`perShot`). Die Projektion speichert dafür
je Kennzahl mit `pooling: "mean"` die Streuung der Schusswerte (`sd`). Darauf setzen Box, Kacheln, Vergleiche, Lage,
gleitender Schnitt, Abstand zum Schnitt davor und R8 auf. Die Bausteine in `shot-ui` rechnen nichts selbst, sie rufen
die neuen Funktionen.

### Die Rechnung über zwei Ebenen (`packages/shot-core/src/analysis/levels.ts`)

Je Scheibe i: nᵢ Schüsse, Mittel x̄ᵢ (Dimension d = 1 oder 2), Abweichungsquadrate Sᵢ = Σ (x − x̄ᵢ)(x − x̄ᵢ)ᵀ.
N = Σ nᵢ, k Scheiben.

- x̄ = Σ nᵢ x̄ᵢ / N (das Mittel aller Schüsse)
- W = Σ Sᵢ / (N − k) (Streuung innerhalb der Scheiben)
- M = Σ nᵢ (x̄ᵢ − x̄)(x̄ᵢ − x̄)ᵀ / (k − 1)
- Vortest: F = tr(W⁻¹M) / d mit F(d(k − 1), d(N − k)); `wanderP`; `wander = wanderP < WANDER_ALPHA` (0,25)
- ohne Wandern: T = (Σ Sᵢ + (k − 1)M) / (N − 1), V = T / N, ν = N − 1
- mit Wandern: n₀ = (N − Σ nᵢ² / N) / (k − 1), B = psd((M − W) / n₀) (Eigenwerte unter 0 auf 0),
  V = (B Σ nᵢ² + W N) / N², ν = k − 1
- gegen 0: T² = x̄ᵀ V⁻¹ x̄, F = (ν − d + 1) / (d ν) · T² mit F(d, ν − d + 1)
- zwei Seiten: D = x̄ₐ − x̄_b, V = Vₐ + V_b, ν = (tr V)² / ((tr Vₐ)² / νₐ + (tr V_b)² / ν_b), T² = Dᵀ V⁻¹ D, F wie oben

Für d = 1 ohne Wandern ist das der t-Test über alle Schüsse, für gleiche nᵢ mit Wandern der t-Test über die Mitten der
Scheiben. Für d = 2 ohne Wandern ist T² gleich Hotelling über alle Schüsse (`confidenceOf`).

### Streuung zweier Zeiträume (P5, P6)

Je Scheibe νᵢ und sᵢ² (`group.sdX`, `group.sdY`: νᵢ = nᵢ − 1, sᵢ der Wert; `group.sigma`: νᵢ = 2(nᵢ − 1),
sᵢ = σ̂ᵢ · c4(2nᵢ − 1)). Gepoolt s² = Σ νᵢ sᵢ² / Σ νᵢ, gezeigt √s² (bei σ geteilt durch c4(Σ νᵢ + 1)).
Vortest je Seite: yᵢ = ln sᵢ², Gewicht νᵢ/2, Q = Σ (νᵢ/2)(yᵢ − ȳ)² mit χ²(k − 1), Wandern bei p < 0,25. Ohne Wandern
auf beiden Seiten F = s²ₐ / s²_b mit F(Σνₐ, Σν_b), zweiseitig. Sonst Welch-t über die yᵢ beider Seiten. Ein Urteil nur,
wenn der Test und die gepoolten Werte in dieselbe Richtung zeigen.

## Files to change

- `packages/shot-core/src/stats.ts` (+ Test): `incompleteBeta`, `fSurvival`, `gammaSurvival`
- `packages/shot-core/src/metrics.ts` (+ Test): `pooling`, `perShot`
- `packages/shot-core/src/analysis/period.ts`: `CardValue.sd`, `cardValues` mit `sd`, `periodTrend` mit Pooling,
  `PeriodComparison.basis`
- `packages/shot-core/src/analysis/projection.ts` (+ Test): `sd`, `PROJECTION_VERSION` 5, `projectedValues`
- `packages/shot-core/src/analysis/levels.ts` (neu, + Test): zwei Ebenen, `pooledValue`, `compareValues`,
  `compareSpreads`
- `packages/shot-core/src/analysis/pattern.ts` (+ Test): `positionPoints` mit Streuung, `positionOverTime` über zwei
  Ebenen, `periodShape` mit c4
- `packages/shot-core/src/analysis/compare.ts` (+ Test): `compareCenterGroups`
- `packages/shot-core/src/analysis/records.ts` (+ Test): R8 über `periodTrend(values, "mean")`
- `packages/shot-core/src/analysis/index.ts`, `catalog.ts`: Exporte und `ANALYSIS_CATALOG`
- `packages/shot-ui/src/period/item.ts`, `fromProjection.ts`, `model.ts`, `PositionTimeline.tsx`, `PeriodResult.tsx`,
  `PeriodTiles.tsx` (Kommentare), `season.test.ts` und weitere Tests der Seite
- `packages/shot-ui/src/compare/model.ts` (+ Test)
- `packages/shot-ui/src/start/model.ts`, `packages/shot-ui/src/list/evenings.ts` (+ Tests)
- `apps/treffsicher/src/lib/statistics/periodItems.ts` (Typ, + Test)
- `packages/shot-help/scripts/simulate.ts`, `packages/shot-help/src/topics.ts`, `packages/shot-help/src/guide.ts`
- `vault/spiegel/spiegel-statistics.md`, `spiegel-statistics-help.md` (erzeugt), `spiegel-langzeit.md`,
  `spiegel-navigation.md`, `spiegel-vergleichen.md`, `spiegel-metrics.md`, `vault/apps/treffsicher/statistics-visualization.md`
- `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`

## Required Docs (vor Implementierung lesen)

- [`vault/decisions/adr-034.md`](../vault/decisions/adr-034.md), [`adr-031.md`](../vault/decisions/adr-031.md)
  (Projektion, Versionen)
- [`packages/shot-core/CLAUDE.md`](../packages/shot-core/CLAUDE.md) (Regeln „Ehrlich statt scheingenau“, „Über viele
  Scheiben“, „Projektion gleich Live-Rechnung“, „Simulation nachziehen“, `toBeCloseTo` und null)
- [`packages/shot-ui/CLAUDE.md`](../packages/shot-ui/CLAUDE.md) (Übersichten auf der Projektion, Seite eines Zeitraums,
  Start)
- [`packages/shot-help/CLAUDE.md`](../packages/shot-help/CLAUDE.md) (eine Quelle, Belege nachrechnen)
- [`vault/spiegel/spiegel-statistics.md`](../vault/spiegel/spiegel-statistics.md): Zeilen E2, E4, P5, P6, L9, L10, T1–T5,
  R8, C3, Abschnitte „Ehrliche Zahlen“ und „Belege aus Simulationen“
- [`vault/conventions.md`](../vault/conventions.md) §9 (Charakterisierungstests, Mutation, `toBeCloseTo`)

## Tasks (/implement, je ein fokussierter Commit)

### A1. F- und χ²-Verteilung im Fachkern

`stats.ts`: `incompleteBeta(a, b, x)` (regularisiert, Kettenbruch nach Lentz), `fSurvival(f, d1, d2)` = P(F > f)
= I_{d2/(d2 + d1 f)}(d2/2, d1/2), `gammaSurvival(a, x)` (regularisiert, obere, Reihe bzw. Kettenbruch) für
`chiSquareSurvival(x, df) = gammaSurvival(df/2, x/2)`. Tests aus Tabellen, Toleranz 1e−4:

- `fSurvival(4.1028, 2, 10)`, `fSurvival(2.7109, 5, 20)`, `fSurvival(4.1709, 1, 30)`, `fSurvival(1.9267, 10, 100)`
  je 0,05
- geschlossen für d1 = 2: `fSurvival(2.4, 2, 9)` = (1 + 2 · 2,4 / 9)^(−4,5) = 0,1461
- `chiSquareSurvival(3.8415, 1)`, `(7.8147, 3)`, `(18.307, 10)` je 0,05; gegen `chiSquareCdfEven` für gerade df

Commit: `feat(shot-core): add F and chi-square tail probabilities`

### A2. Pooling in der Registry

`MetricDefinition` bekommt `pooling?: "mean" | "spreadAxis" | "spreadRadial"` und `perShot?: (shot: MetricShot) => number`.
Gesetzt: `result.decimalMean` („mean“, `decimalTenths / 10`), `result.ringsMean` („mean“, `ring`), `result.tensRate`
(„mean“, `ring >= 10 ? 100 : 0`), `group.sdX`, `group.sdY` („spreadAxis“), `group.sigma` („spreadRadial“). Alle übrigen
ohne. Test in `metrics.test.ts`: Jede Kennzahl mit „mean“ hat `perShot`, und an den Testscheiben ist `compute` gleich dem
Mittel von `perShot` über `eligibleShots` (`expectNear`, vorher `not.toBeNull()`); `counterpart` hat dasselbe `pooling`.

Commit: `feat(shot-core): say per metric how it pools over shots`

### A3. Streuung der Schusswerte in Projektion und Werten

- `CardValue` bekommt `sd?: number | null`: Standardabweichung von `perShot` über die gezählten Schüsse (n − 1), null
  unter zwei Schüssen; nur bei `pooling: "mean"`. `cardValues` rechnet sie mit.
- `CardProjection.values[key]` bekommt `sd` (gleiche Rundung wie `value`), `projectedValues` und `itemValues` geben sie
  weiter, `PeriodItem.metrics` erlaubt sie, `fromProjection` reicht sie durch.
- `PROJECTION_VERSION` 5, Kommentar ergänzt: „5: Streuung der Schusswerte (`sd`) der Kennzahlen, die sich über Schüsse
  mitteln“.
- `projection.test.ts`: Gleichheit Projektion = Live-Rechnung auch für `sd`; Version und Ausgabe neu festschreiben.
- Treffsicher `periodItems.ts`: Einheiten mit Einzelschüssen bekommen `sd` aus der Projektion; ohne Einzelschüsse kein
  `sd` (Test in `periodItems.test.ts`).

Commit: `feat(shot-core): store the spread of shot values in the projection`

### A4. Zwei Ebenen (`levels.ts`)

Exporte: `ShotGroup { n: number; mean: readonly number[]; scatter: readonly number[] }` (d = 1: `[ss]`, d = 2:
`[xx, yy, xy]`), `LevelEstimate { shots, groups, mean, cov, df, wander, wanderP }`, `levelEstimate(groups)`,
`levelTestZero(estimate) → { t2, p }`, `levelCompare(a, b) → { delta, t2, p, df }`, `WANDER_ALPHA = 0.25`. Null unter
zwei Scheiben, bei N − k < d + 1 oder singulärer Kovarianz. Tests nach Hand:

- d = 1, drei Scheiben zu je 4 Schuss: [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]. W = 15/9, M = 4, F = 2,4 mit (2, 9),
  `wanderP` 0,1461, also Wandern; n₀ = 4, B = 0,5833, V = 1/3, ν = 2; gegen 0: T² = 36,75, p = 1 − 6,0622/√38,75 = 0,0261.
- d = 1, drei Scheiben [1, 3], [1, 3], [1, 3]: M = 0, `wanderP` 1, kein Wandern; T = 1,2, V = 0,2, ν = 5, T² = 20,
  p zwischen 0,005 und 0,01 (t(5): 4,032 bzw. 4,773).
- d = 2 ohne Wandern: T² gleich `confidenceOf(alle Punkte).t2`.
- d = 2: Drehung aller Punkte um 90° ändert p nicht.
- Vergleich: zwei gleiche Seiten → Δ 0, p 1; Seiten vertauscht → Δ mit anderem Vorzeichen, gleiches p.
- Mutation (§9): Vortest auf „immer Wandern“ und auf „nie Wandern“ stellen, jeweils muss ein Test rot werden.

Commit: `feat(shot-core): estimate over shots and evenings`

### A5. Werte und Vergleiche über die Schüsse

In `levels.ts`:

- `pooledValue(values: readonly CardValue[], metric): number | null`: „mean“ Σ vᵢnᵢ / Σ nᵢ, für E2 auf dem Raster der
  Wertung wie `pooledMean` (Zehntel ×10, Ringe ×1, danach `pooledMean` auf `pooledValue` umstellen und seinen Test
  behalten); „spreadAxis“ √(Σ(nᵢ − 1)vᵢ² / Σ(nᵢ − 1)); „spreadRadial“ wie im Approach; ohne `pooling` das Mittel der
  Werte (wie heute).
- `compareValues(a, b, metric): PeriodComparison | null` (gleiche Form wie `comparePeriods`, Δ = b − a):
  „mean“ mit `sd` an jeder Scheibe → `levelCompare` (d = 1, Sᵢ = (nᵢ − 1)sdᵢ²; für `result.tensRate`
  Sᵢ = nᵢ vᵢ (100 − vᵢ), ohne `sd`), `basis` „shots“ oder „evenings“ (Wandern auf einer Seite); „spread*“ →
  `compareSpreads`; sonst `compareSamples` über die Werte (`basis: "cards"`). Unter fünf Scheiben je Seite kein Test
  wie heute. Urteil bei p < 0,05 nach dem Vorzeichen von Δ; `meaningful` wie heute aus den Werten je Scheibe.
- `PeriodComparison` bekommt `basis: "shots" | "evenings" | "cards"`, `test.exact` bleibt (false außer bei Mann-Whitney
  genau ausgezählt).
- Tests: kurze Scheibe zählt weniger (zwei Scheiben 9,0 mit n = 10 und 10,0 mit n = 40 → 9,8); σ gepoolt gegen eine
  Hand-Rechnung; Vergleich ohne `sd` fällt auf „cards“ zurück; Fixture, in der das Mittel der Mittel und das Mittel über
  die Schüsse in verschiedene Richtungen zeigen (§9: die falsche Quelle muss rot werden).

Commit: `feat(shot-core): pool period values over shots and compare them on two levels`

### A6. Lage über Zeit (L10) und zweier Zeiträume (C3)

- `positionPoints`: jede Scheibe ab drei Punkten auch mit `scatter` (xx, yy, xy um ihre Mitte).
- `positionOverTime(points)`: `levelEstimate` (d = 2) über diese Scheiben; `mean` ist die Mitte aller ihrer Schüsse,
  `offsetUm` ihr Abstand, statt `t2`/`critical` jetzt `p` und `wander`; `verdict` „few“ unter fünf Scheiben oder ohne
  Schätzung, „offset“ bei p < 0,05, sonst „fits“. `periodPattern` rundet wie bisher.
- `periodShape`: `sigmaUm` mit c4(2ν + 1), damit Präzision und Kachel dieselbe Streuung zeigen.
- `compare.ts`: `compareCenterGroups(a: readonly PatternCard[], b: readonly PatternCard[]): CenterComparison | null`
  über `levelCompare` (d = 2), Mitten über die Schüsse, „few“ unter fünf Scheiben je Seite; `compareCenters` bleibt für
  zwei Scheiben (C2).
- Tests: Charakterisierung des Falls vom 22. Oktober mit festen Punkten (sieben Scheiben, Mitten hoch, zwei kurze tief,
  Streuung in der Höhe ohne Wandern): neu „offset“, `mean` gleich der Mitte aller Punkte. Gegenprobe: Mitten auf
  Mittel der Mitten zurückstellen, Test muss rot werden.

Commit: `feat(shot-core): judge the position of a period over shots and evenings`

### A7. Gleitender Schnitt, Abstand zum Schnitt davor, beste Form

- `periodTrend(values, pooling = null)`: der Schnitt über das Fenster mit `pooledValue`-Regel; Band unverändert aus den
  Abweichungen der Scheiben.
- `deltasBefore(values, ids, window, pooling = null)` in `shot-ui/period/model.ts`: Schnitt davor mit derselben Regel.
- R8 in `records.ts`: `periodTrend(values, "mean")`.
- `trailingMean` in `PositionTimeline.tsx`: nimmt `{ value, n }` und gewichtet mit n.
- Tests: Fenster mit 10 und 40 Schuss gewichtet; R8 an einer Folge, in der kurze Scheiben den ungewichteten Schnitt
  vorn hätten.

Commit: `feat(shot-core): weight moving averages by shots`

### A8. Seite eines Zeitraums, Start und Liste

- `periodModel`: `summary.mean` = `pooledValue(perShot, E2)`; Kacheln `value` = `pooledValue`, Vergleich =
  `compareValues(theirs, own, base)`; `form` über `compareValues`; `trend` und `deltas` mit `chartMetric.pooling`.
- `startModel`: `periodTrend(values, "mean")`; `list/evenings.ts`: `deltasBefore(…, "mean")`.
- Kommentare in `PeriodResult.tsx` und `PeriodTiles.tsx`: „über alle Wertungsschüsse“, Tempo „Mittel je Scheibe“.
- `season.test.ts` und weitere Erwartungen: jede geänderte Zahl im Commit begründen (Gewichtung oder neuer Test);
  ändert sich etwas anderes (Zahl der Scheiben, Rekorde außer R8, Monate), Circuit-Breaker.

Commit: `feat(shot-ui): show period numbers over all shots`

### A9. Seite Vergleichen

`groupCompareModel`: Zeilen über `pooledValue` und `compareValues`, Lage über `compareCenterGroups(pa, pb)`. `unit`
bleibt „card“ (der Text „zu wenige Scheiben“ stimmt weiter, das Urteil braucht fünf je Seite). Tests in
`compare/model.test.ts`.

Commit: `feat(shot-ui): compare periods over shots and evenings`

### A10. Simulation

`packages/shot-help/scripts/simulate.ts`: Generator mit Wandern (`wander`: Mitte je Scheibe aus N(0, τ²) je Achse,
τ als Anteil von σ) und gemischten Schusszahlen (jede dritte Scheibe 10, sonst 40). Raster: τ 0; 0,1; 0,2; 0,3 ×
Schusszahlen alle 40 oder gemischt × k 5, 10, 20; 5 000 Läufe je Zelle.

- B25 neu: Lage über Zeit, Fehlalarm ohne Versatz je Zelle; erkannt bei Versatz 0,3σ.
- B28 neu (Zeiträume): Lage zweier Seiten über `compareCenterGroups`, Fehlalarm und 0,3σ.
- B19 neu: Ø je Schuss zweier Zeiträume über `compareValues`, Fehlalarm und σ 1,5 → 1,3 mm wie bisher.
- B29 neu: Streuung zweier Zeiträume über `compareSpreads`; Wandern der Präzision: σ je Scheibe × exp(N(0, w²)),
  w 0; 0,1; 0,2.

Ausgabe in den Block „Belege aus Simulationen“ des Katalogs. **Abnahme:** Fehlalarm ≤ 6,5 % in jeder Zelle, ≤ 5,5 % bei
τ = 0 bzw. w = 0.

Commit: `test(shot-help): simulate period tests with short cards and wandering evenings`

### A11. Hilfetexte

`topics.ts` und `guide.ts` nach dem Abschnitt „Texte“ unten; danach `pnpm --filter @vereinsheim/shot-help docs`.

Commit: `docs(shot-help): explain period numbers over shots and evenings`

### A12. Doku

- Katalog: E2, E4, P5, P6 (Ebene Zeitraum über die Schüsse), L10 und C3 (zwei Ebenen, B25, B28 neu), T1 und R8
  (gewichtet), T3 (bleibt je Scheibe, Grund), Z1 (bleibt je Scheibe, Grund), „Ehrliche Zahlen“ um den Grundsatz
  ergänzen, Belege-Block.
- `packages/shot-core/CLAUDE.md`: Regel „Über viele Scheiben“ neu (Werte über die Schüsse, Urteile über zwei Ebenen,
  Verfahren `levels.ts`, `pooling`), „Ehrlich statt scheingenau“ um den Vortest ergänzen.
- `packages/shot-ui/CLAUDE.md`: `PeriodResult`, `PeriodTiles`, Start („Einheit ist die Scheibe“ → Verlauf zeigt
  Scheiben, Schnitt über die Schüsse).
- `spiegel-navigation.md` Z. 171, `spiegel-langzeit.md`, `spiegel-vergleichen.md`, `spiegel-metrics.md`,
  `statistics-visualization.md`: Einheit nachziehen, auf [[adr-034]] verweisen.
- Dann `/sync-graph`.

Commit: `docs: record period numbers over shots (ADR-034)`

## Texte (zur Freigabe mit dem Plan)

Keine neuen Texte auf den ersten beiden Ebenen. Geändert werden die Erklärungen im Blatt „?“:

- **Ø je Schuss eines Zeitraums** (Box, Kachel): „Alle Ringe des Zeitraums geteilt durch alle Wertungsschüsse. Eine
  Scheibe mit 40 Schuss zählt viermal so viel wie eine mit 10.“
- **Zehnerquote, Streuung** (Kacheln): „Über alle Schüsse des Zeitraums gerechnet. Die Streuung misst jede Scheibe um
  ihre eigene Mitte.“
- **Tempo** (Kachel): „Das Mittel der Tempi deiner Scheiben. Ein Median lässt sich nicht über Scheiben zusammenrechnen.“
- **Vergleich zweier Zeiträume** (C3): „Spiegel prüft zuerst, ob deine Abende stärker voneinander abweichen, als der
  Zufall der Schüsse erklärt. Wenn nicht, zählt jeder Schuss. Wenn doch, zählt jeder Abend für sich. So macht ein
  einzelner guter oder schlechter Abend nicht zu sicher. Ein Urteil gibt es ab fünf Scheiben je Seite.“
- **Lage über Zeit** (L10): „Die Mitte aller Schüsse, der geviertelte Kreis im Bild. ‚Versetzt‘ sagt Spiegel nur, wenn
  das kein Zufall sein kann. Dafür prüft Spiegel zuerst, ob deine Abende verschieden liegen. Liegen sie gleich, zählt
  jeder Schuss. Liegen sie verschieden, zählt jeder Abend für sich. Ein Urteil gibt es ab fünf Scheiben.“
- **Abstand zum Schnitt davor**, Formel: „Δ = Ø je Schuss der Scheibe − Ø je Schuss über alle Wertungsschüsse der bis
  zu fünf Scheiben davor, ohne sie selbst“.
- **Verlauf**, Satz zur Linie: „Die Linie ist der Schnitt der letzten fünf Scheiben, über ihre Schüsse gerechnet.“

Formeln (`formula`) der Themen L10, C3, E2 nach dem Approach oben.

## Test steps (nach Implement, committeter Stand)

```bash
export PATH=/Users/christian/.nvm/versions/node/v24.12.0/bin:$PATH && unset -f node pnpm npm npx; pnpm check
```

```bash
pnpm --filter @vereinsheim/shot-help simulate
```

```bash
pnpm --filter spiegel pruefen --start
```

## Validate (in `reports/2026-10-22-period-shot-basis.md`)

- Dev-Kopie: Spiegel neu starten (Projektionen Version 5 im Hintergrund), Fortschritt Luftpistole, Trefferbild für 30
  Tage, 90 Tage, 6 und 12 Monate: Satz und Kreis notieren. Erwartet nach der Rechnung vom 22. Oktober: „versetzt: hoch“
  in allen vier, Zahl im Satz gleich der Mitte des Kreises (gut 2,5 mm). Weicht ein Urteil ab, im Bericht begründen.
- Box und Kacheln eines Zeitraums mit kurzen Scheiben gegen Σ/Σ aus der Liste nachrechnen.
- Seite Vergleichen: 30 Tage gegen die 30 davor, Lage und Ø mit Urteil und Grundlage.
- Treffsicher: Statistik einer Disziplin mit und ohne Einzelschüsse öffnet ohne Fehler.
- Was die Daten nicht hergeben, steht als „nicht belegt“ mit dem Test, der den Pfad deckt (§9).

## Verification (Erfolgskriterium)

- Kein Wert eines Zeitraums ist mehr ein Mittel der Mittel, außer Tempo und den Zahlen je Scheibe aus der Entscheidung.
- Kreis im Trefferbild und „im Mittel x mm“ im Satz sind dieselbe Mitte.
- Simulation erfüllt die Abnahme; Katalog, Hilfe und CLAUDE.md nennen das Verfahren.
- `pnpm check` grün, `pruefen` ohne FAIL.

## Circuit-Breaker

- Die Simulation verfehlt die Abnahme in einer Zelle: anhalten, Tabelle dem User zeigen. Möglichkeiten: Vortest mit
  α 0,5 oder immer zwei Ebenen mit Satterthwaite.
- Eine Charakterisierung ändert sich in etwas anderem als den gemittelten Zahlen: anhalten.
- `PROJECTION_VERSION` 5 rechnet in Tests oder beim Start mehr als die Projektionen neu (etwa Revisionen): anhalten.

## Zurückgestellt

- Tempo über alle Abstände (bräuchte die Abstände in der Projektion).
- Ein Hinweis „Visier verstellt“ als Grenze eines Zeitraums. Bis dahin hilft ein Zeitraum ab dem Tag der Verstellung.
