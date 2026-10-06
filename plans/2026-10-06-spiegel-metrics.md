# SP-1.2 Fachkern: Geometrie und Kennzahlen-Registry

**Datum:** 2026-10-06 · **Branch:** `feat/spiegel-metrics` · **Paket:** `@vereinsheim/shot-core` ·
**Roadmap:** SP-1.2 in `vault/spiegel/spiegel-roadmap.md`

## 1. Context (warum)

SP-1.1 wertet einzelne Schüsse. Für Session, Serien, Verläufe, Vergleiche und Rekorde braucht Spiegel
die Rechenbasis für ganze Gruppen: Schwerpunkt, Streukreis, mittlerer Radius, Streuung, Tempo. Dazu
kommt die Kennzahlen-Registry aus `vault/spiegel/spiegel-metrics.md`: Eine Kennzahl ist eine reine,
versionierte Funktion mit Einheit, Richtung und Regeln für Probe, Mindestzahl und Ausreißer. Daraus
entstehen später ohne weiteren Code die Kachel, die Serienspalte, der Verlauf und der Vergleich.

Wie SP-1.1 hängt das an nichts aus Phase 0: reine Mathematik auf Lage, Werten und Zeit. Die
Sonderfälle SF-01, SF-14, SF-60, SF-61, SF-62 und SF-63 gehören laut Roadmap hierher.

## 2. Entscheidungen

**E1: Eigener Eingabetyp `MetricShot`.** Die Kennzahlen kennen nur, was sie brauchen:

```ts
export interface MetricShot {
  /** Lage in µm; null bei Ergebnissen nur aus dem PDF */
  xUm: number | null
  yUm: number | null
  /** Wert in Zehnteln (94 = 9,4), amtlich oder neu gewertet; null unbekannt */
  decimalTenths: number | null
  ring: number | null
  innerTen: boolean
  /** Abstand zur Mitte in µm, etwa aus dem Teiler; sonst aus der Lage */
  distanceUm?: number | null
  /** Abgabezeit in ms (UTC); null unbekannt */
  firedAtMs: number | null
  kind: "match" | "probe"
  series: number | null
  /** etwa "fehlschuss", "verdaechtig" (SF-14, SF-15) */
  flags?: readonly string[]
}
```

Das kanonische Modell (SP-1.6) bildet sich darauf ab. Schüsse ohne Lage zählen bei Lage-Kennzahlen
nicht mit, Schüsse ohne Wert nicht bei Ergebnis-Kennzahlen, Schüsse ohne Zeit nicht beim Tempo.

**E2: Geometrie in µm, Ausgabe in mm.** Die Geometrie rechnet mit Gleitkomma in µm (die Werte
selbst kommen exakt aus SP-1.1). Kennzahlen geben natürliche Einheiten aus: mm, Ringe, Zehntel als
Dezimalzahl (51,8), Sekunden.

**E3: Streukreis als kleinster umschließender Kreis der Trefferzentren,** ohne Kaliber
(Mitte zu Mitte). Inkrementeller Algorithmus nach Welzl ohne Zufall, damit das Ergebnis
deterministisch ist; Toleranz 1e-6 µm. Bei 200 Schuss ist auch der schlechteste Fall schnell genug.
Zusätzlich `extremeSpread` (größter Abstand zweier Treffer): Welches der beiden Meytons
„Trefferkreis“ ist, klärt SP-0.6 an den Rohdaten.

**E4: Streumaße.** Schwerpunkt = Mittel von x und y. Mittlerer Radius = Mittel der Abstände zum
Schwerpunkt. R50 = Median dieser Abstände (robust; lässt markierte Schüsse weg). Streuung x/y =
Stichproben-Standardabweichung (n − 1). Streu-Ellipse aus der Kovarianzmatrix: Halbachsen = Wurzel der
Eigenwerte (1 σ), Winkel der großen Achse.

**E5: Tempo.** Intervalle zwischen aufeinanderfolgenden Schüssen nach Zeit; ein Intervall über
180 s ist eine Pause (SF-62). Kennzahlen: Median der Intervalle ohne Pausen, längste Pause, Zahl der
Pausen, Dauer vom ersten bis zum letzten Schuss.

**E6: Registry.**

```ts
export interface MetricDefinition {
  key: string
  label: string
  unit: "Ringe" | "Zehntel" | "Teiler" | "mm" | "s" | "Schuss"
  decimals: number
  scopes: readonly ("series" | "card")[]
  better: "higher" | "lower" | "none"
  version: number
  /** welche Schüsse zählen; Ergebnis-Kennzahlen nur "match" (SF-01) */
  appliesTo: readonly ("match" | "probe")[]
  /** darunter kein Wert, nicht 0 (SF-61) */
  minShots: number
  /** wächst mit der Schusszahl: Vergleiche nur bei gleichem n (SF-60) */
  nSensitive: boolean
  /** markierte Schüsse weglassen (robuste Maße, SF-14) */
  excludeFlagged: boolean
  /** welche Angabe die Schüsse brauchen */
  needs: "value" | "position" | "time"
  compute: (shots: readonly MetricShot[]) => number | null
}
export function defineMetric(def: MetricDefinition): Readonly<MetricDefinition>
export function computeMetric(metric: MetricDefinition, shots: readonly MetricShot[]): number | null
export const METRICS: readonly Readonly<MetricDefinition>[]
export function metricByKey(key: string): Readonly<MetricDefinition> | undefined
```

`computeMetric` filtert nach `appliesTo`, `needs` und `excludeFlagged`, prüft `minShots` und ruft
erst dann `compute` auf. Die Auswahl der Ebene (eine Serie, die ganze Scheibe) trifft der Aufrufer.

**E7: Die ersten Kennzahlen.**

| key | Name | Einheit | besser | gilt für | min | n-abhängig | braucht |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `result.rings` | Ringe | Ringe | höher | Wertung | 1 | ja | Wert |
| `result.decimal` | Zehntel | Zehntel | höher | Wertung | 1 | ja | Wert |
| `result.decimalMean` | Ø je Schuss | Zehntel | höher | Wertung | 1 | nein | Wert |
| `result.tens` | Zehner | Schuss | höher | Wertung | 1 | ja | Wert |
| `result.innerTens` | Innenzehner | Schuss | höher | Wertung | 1 | ja | Wert |
| `result.bestTeiler` | bester Teiler | Teiler (1/100 mm) | niedriger | Wertung | 1 | ja | Lage |
| `group.mpiDistance` | Schwerpunkt-Abstand | mm | niedriger | beide | 2 | nein | Lage |
| `group.enclosingDiameter` | Streukreis | mm | niedriger | beide | 3 | ja | Lage |
| `group.meanRadius` | mittlerer Radius | mm | niedriger | beide | 3 | nein | Lage |
| `group.r50` | R50 | mm | niedriger | beide | 5 | nein | Lage, ohne markierte |
| `group.sdX` / `group.sdY` | Streuung x / y | mm | niedriger | beide | 3 | nein | Lage |
| `time.intervalMedian` | Tempo (Median) | s | – | beide | 3 | nein | Zeit |
| `time.longestPause` | längste Pause (0 ohne Pause) | s | – | beide | 2 | ja | Zeit |
| `sighter.offset` | Versatz Probe → Wertung | mm | niedriger | beide | 6 | nein | Lage |

„Bester Teiler“ nimmt den Abstand aus dem Teiler, sonst aus der Lage. „Versatz Probe → Wertung“
misst den Abstand der Schwerpunkte der letzten fünf Probeschüsse und aller Wertungsschüsse; er
braucht mindestens drei Probe- und drei Wertungsschüsse (SF-63). Weitere Kennzahlen aus der
Notiz (Ermüdung, Wanderung, Tempo-Konstanz, Streuung der Serien) folgen in SP-2.1/2.2.

**E8: Visier verstellt (SF-63).** `segmentGroups(shots, adjustAfter)` teilt eine Folge an den
Schussnummern, nach denen das Visier verstellt wurde; Gruppenkennzahlen rechnet der Aufrufer je
Teilstück. Das Ereignis selbst speichert SP-2.3 (Notizen, Ereignisse).

**E9: Nicht in diesem Feature:** Verläufe über Zeit und Rekorde (SP-2.1), Beobachtungen in Worten
(SP-2.2), Darstellung (SP-1.8), Speicherung der Kennzahlwerte (SP-1.6).

## 3. Dateien

| Datei | Änderung |
| --- | --- |
| `packages/shot-core/src/geometry.ts` (+ `.test.ts`) | Schwerpunkt, Abstände, Streukreis, `extremeSpread`, mittlerer Radius, R50, Streuung, Ellipse, `segmentGroups` |
| `packages/shot-core/src/time.ts` (+ `.test.ts`) | Intervalle, Pausen, Dauer |
| `packages/shot-core/src/metrics.ts` (+ `.test.ts`) | `MetricShot`, `defineMetric`, `computeMetric`, `METRICS`, `metricByKey` |
| `packages/shot-core/package.json` | Exporte `./geometry`, `./time`, `./metrics` |
| `packages/shot-core/CLAUDE.md` | Exporttabelle, Regeln der Registry |
| `vault/spiegel/spiegel-metrics.md` | Abschnitt „Umsetzung“ |
| `vault/spiegel/spiegel-roadmap.md` | SP-1.2: Status erledigt |

## Required Docs

- `vault/spiegel/spiegel-metrics.md` (Registry, Kennzahlen, Vergleichbarkeit und Robustheit)
- `vault/spiegel/spiegel-edge-cases.md` → SF-01, SF-14, SF-60 bis SF-63
- `packages/shot-core/CLAUDE.md` (Paketregeln)
- `vault/conventions.md` §9 (Eigenschaftstests, Mutationsprobe)

## 4. Tasks

Konventionen wie in SP-1.1: Code englisch, Kommentare und Testtitel deutsch, Test zuerst. Jede Task
endet mit `pnpm turbo run check-types test format:check --filter=@vereinsheim/shot-core`, dann
`pnpm check`.

### Task 1: Geometrie (`geometry.ts`)

```ts
export interface Point { xUm: number; yUm: number }
export interface Circle { xUm: number; yUm: number; radiusUm: number }
export function centroid(points: readonly Point[]): Point | null
export function distancesTo(points: readonly Point[], center: Point): number[]
export function smallestEnclosingCircle(points: readonly Point[]): Circle | null
export function extremeSpread(points: readonly Point[]): number | null
export function meanRadius(points: readonly Point[]): number | null
export function r50(points: readonly Point[]): number | null
export function standardDeviation(values: readonly number[]): number | null
export function covarianceEllipse(points: readonly Point[]): { majorUm: number; minorUm: number; angleRad: number } | null
export function segmentGroups<T>(shots: readonly T[], adjustAfter: readonly number[]): T[][]
```

- Leere Eingabe → `null`; ein Punkt → Kreis mit Radius 0, Streuung `null` (n − 1 = 0).
- `smallestEnclosingCircle`: inkrementell ohne Zufall (für jeden Punkt außerhalb neu mit ihm auf
  dem Rand, dann mit zwei, dann mit drei Randpunkten); kollineare Dreiergruppen über den Kreis der
  beiden äußeren Punkte. `segmentGroups` teilt nach den angegebenen Schussnummern (1-basiert).

Tests `geometry.test.ts`:

- Quadrat (0,0), (2000,0), (0,2000), (2000,2000): Schwerpunkt (1000, 1000), Streukreis-Radius
  1414,21 µm, `extremeSpread` 2828,43 µm.
- Gleichseitiges Dreieck mit 3000 µm Seite: Radius 1732,05 µm. Stumpfes Dreieck (0,0), (4000,0),
  (2000,500): Kreis über der langen Seite, Mitte (2000, 0), Radius 2000. Drei Punkte auf einer
  Linie: Radius = halber größter Abstand.
- Eigenschaft: 300 Mengen mit 3–60 Punkten aus einem festen Zufallsgenerator (LCG mit Startwert):
  alle Punkte liegen im Kreis (Toleranz), und der Radius gleicht dem kleinsten Kreis aus allen
  Paaren und Dreiergruppen (Brute Force).
- Verschieben um (12 340, −5 670) ändert Radius, mittleren Radius, R50 und Streuung nicht.
- Streuung: x-Werte −1000, 0, 1000 → 1000 µm (n − 1).
- Quadrat plus Mittelpunkt (1000, 1000): Abstände viermal 1414,21 und einmal 0 µm → R50 1414,21 µm
  (Median), mittlerer Radius 1131,37 µm (Mittel).
- Ellipse: Punkte entlang x gestreckt → Winkel 0 (oder π), große Achse > kleine; um 45° gedreht →
  Winkel π/4.
- `segmentGroups` mit 10 Schüssen und `[4]` → Teilstücke mit 4 und 6 Schüssen; leere Liste → ein
  Teilstück.

Commit: `feat(shot-core): add group geometry for shot patterns`.

### Task 2: Tempo (`time.ts`)

```ts
export const PAUSE_THRESHOLD_MS = 180_000
export interface Tempo { intervalsMs: number[]; pausesMs: number[]; medianIntervalMs: number | null; longestPauseMs: number | null; durationMs: number | null }
export function tempo(firedAtMs: readonly number[]): Tempo
```

Zeiten werden sortiert; Intervalle über 180 s zählen als Pause und nicht zum Median.

Tests: Zeiten 0, 50, 105, 400, 452 s → Intervalle 50, 55, 52 s, Pause 295 s, Median 52 s, Dauer
452 s; genau 180 s ist noch keine Pause, 180,001 s schon; ein Schuss → Median `null`, Dauer 0;
unsortierte Eingabe → dasselbe Ergebnis.

Commit: `feat(shot-core): measure pace and pauses`.

### Task 3: Registry und Kennzahlen (`metrics.ts`)

Typen und Funktionen aus E1 und E6, Kennzahlen aus E7.

Tests `metrics.test.ts` mit einer Fixture-Scheibe: die sechs Wertungsschüsse vom Ausdruck des
2. Oktober (Werte 105, 105, 103, 76, 67, 62; Lage auf den Achsen wie in der Spielwiese; Zeiten im
Abstand von 50 s) und fünf Probeschüsse um (1000, −1000) µm davor.

- Ergebnis: Ringe 49, Zehntel 51,8, Ø 8,63, Zehner 3, Innenzehner 2, bester Teiler 331,8.
- **Nur Probe (SF-01):** dieselben Schüsse als Probe → alle Ergebnis-Kennzahlen `null`, Lage- und
  Tempo-Kennzahlen mit Wert.
- **Mindestzahl (SF-61):** zwei Schüsse → Streukreis `null`, drei → Wert; R50 erst ab fünf.
- **Ausreißer (SF-14):** ein als `fehlschuss` markierter Schuss fehlt bei R50, zählt aber beim
  Streukreis.
- **Schusszahl (SF-60):** `nSensitive` ist bei Streukreis, Ringen, Zehnteln, Zehnern, Innenzehnern
  gesetzt und bei mittlerem Radius, R50, Ø je Schuss nicht; Streukreis über alle Schüsse ≥ über die
  ersten fünf.
- **Pausen (SF-62):** eine Pause von 5 min ändert den Tempo-Median nicht.
- **Visier verstellt (SF-63):** zehn Probeschüsse bei (5000, 5000), dann fünf bei (0, 0), Wertung um
  (0, 0) → Versatz ≈ 0; mit allen Probeschüssen wäre er groß.
- **Ohne Lage** (PDF-Ergebnis): Ergebnis-Kennzahlen gelten, Lage-Kennzahlen `null`.
- Registry: Schlüssel eindeutig, jede Version ≥ 1, `metricByKey` findet jede Kennzahl, Definitionen
  eingefroren.

Commit: `feat(shot-core): add the metric registry with the first metrics`.

### Task 4: Dokumentation

- `packages/shot-core/package.json`: Exporte `./geometry`, `./time`, `./metrics` (gehören in die
  Task, in der die Datei entsteht).
- `packages/shot-core/CLAUDE.md`: Exporttabelle um die drei Module; Regel: neue Kennzahl nur über
  `defineMetric` mit Test, Formeländerung erhöht die Version.
- `vault/spiegel/spiegel-metrics.md`: Abschnitt „Umsetzung“ mit E3 bis E7 in Kürze; Hinweis, dass
  `extremeSpread` neben dem Streukreis existiert, bis SP-0.6 Meytons „Trefferkreis“ klärt.
- `vault/spiegel/spiegel-roadmap.md`: SP-1.2 Status „erledigt“.
- `node .claude/vault-lint.mjs` grün.

Commit: `docs(spiegel): document the metric registry`.

## 5. Verification

1. `pnpm check` grün; Zahl der Tests im Bericht.
2. **Mutationsprobe (conventions §9):** testweise einspielen, rot beobachten, zurücknehmen:
   - Streukreis prüft Enthaltensein ohne Toleranz → Eigenschaftstest rot oder unverändert grün
     (dann Toleranz begründen).
   - R50 als Mittel statt Median → Ausreißer-Test rot.
   - Streuung mit n statt n − 1 → Streuungstest rot.
   - Pausen-Grenze ignoriert → Tempo-Test rot.
   - Versatz mit allen Probeschüssen → SF-63-Test rot.
   - `minShots`, `appliesTo` oder `excludeFlagged` in `computeMetric` übergangen → je ein Test rot.
3. Spielwiese: Schwerpunkt, Streukreis und die Kennzahlen dort einbauen und einmal ansehen (nicht im
   Repo).
4. `git diff main --stat`: nur `packages/shot-core`, die zwei Vault-Notizen, der Plan.

## 6. Nachtrag (6. Oktober 2026): Wertung umschaltbar

**Anlass:** Der User will überall zwischen ganzzahliger und Zehntel-Wertung umschalten können. Die
Registry muss das tragen, sonst fehlt der Ansicht (SP-1.8) zu manchen Kennzahlen das Gegenstück.

**Änderung (Task 5, nach FINALIZE interaktiv umgesetzt):**

- `MetricNeed` `"value"` aufgeteilt in `"ring"` und `"decimal"`: Ganze Ringe brauchen nur den Ring,
  Zehntel den Zehntelwert. Ein Ganzring-Ausdruck ohne Zehntel liefert so das Ergebnis in Ringen und
  in Zehnteln „kein Wert“ (SF-18); vorher fiel er ganz heraus.
- `MetricDefinition` um `scoring` (`"rings" | "decimal"`) und `counterpart` ergänzt; `defineMetric`
  verlangt beide zusammen und einen fremden Schlüssel.
- Neue Kennzahl `result.ringsMean` (Ø je Schuss in Ringen) als Gegenstück zu `result.decimalMean`;
  `result.rings`/`result.decimal` heißen beide „Ergebnis“, die Schnitte beide „Ø je Schuss“.
- `inScoring(metric, scoring)` wählt das Gegenstück; Kennzahlen ohne Wertung bleiben.
- Tests: Ganzring ohne Zehntel; Registry-Test „jede Zehntel-Kennzahl hat ein Ringe-Gegenstück mit
  gleichen Regeln, und umgekehrt“; `inScoring`; `defineMetric` lehnt halbe Paare ab.
- Mutationsprobe um N1–N4 erweitert (inScoring, Ringe-Schnitt, Bedarf „ring“, Paarprüfung).

## 7. Nachtrag (6. Oktober 2026): Abweichungen und Review

**Abweichungen vom Plan:** `needs: "distance"` für den besten Teiler (gemessener Abstand vor der Lage,
statt „braucht Lage“ in E7); Zahl der Pausen und Dauer liefert `tempo()`, sie sind keine Kennzahlen
der Registry (E5); die Eigenschaftstests nutzen 3–25 statt 3–60 Punkte.

**Review-Fixes** (Bericht `reports/2026-10-06-spiegel-metrics-review.md`):

- Verdächtige Schüsse (SF-15) zählen nur mit ihrem Wert, nie mit Lage, Abstand oder Zeit; `FLAG_MISS`
  und `FLAG_SUSPICIOUS` getrennt, `excludeFlagged` heißt jetzt `excludeMisses`.
- `onMissing: "drop" | "null"`: Summen und Zählungen ohne vollständige Angaben geben keinen Wert;
  `eligibleShots` liefert das n für Vergleiche (SF-60).
- Gültig sind nur endliche Zahlen, ein Abstand nicht negativ.
- Abgabefolge `seq` (SF-30): `inShotOrder`; `tempo()` nimmt die Zeiten in Abgabefolge und zählt
  Rücksprünge der Uhr nicht; der Versatz nimmt nur Probeschüsse vor dem ersten Wertungsschuss.
- Einheit „Ringe“ für beide Wertungen; Schwerpunkt-Abstand `nSensitive`; Radien und Streuung mit zwei
  Nachkommastellen; `METRICS` eingefroren; `defineMetric` prüft Schlüssel und Nachkommastellen.
- Tests mit festen Werten für jede Gruppen-Kennzahl (Fixture mit verschiedener Streuung in x und y und
  geradem n), Paar-Test mit Liste der wertungsfreien Kennzahlen, `expectNear` gegen null-als-0.

