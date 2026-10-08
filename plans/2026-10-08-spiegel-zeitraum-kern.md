# Plan: Fachkern für Zeiträume (Spiegel, L2)

- Branch: `feat/spiegel-zeitraum-kern` (von `main` 9fd71be)
- Grundlage:
  - [[spiegel-langzeit]]: Entwurf, Vorgaben, Bauschritt L2
  - [[spiegel-statistics]]: Katalog T1, T2, T3, T5, T6, C3, C4, R1–R8
  - [[spiegel-metrics]]: Verläufe, Vergleiche, Robustheit
- Roadmap: SP-2.1 (Verläufe und Rekorde) und SP-2.2 (Vergleiche), jeweils der Fachkern; die Oberfläche folgt in L3.
- Anlass: User, 8. Oktober 2026: „plan für L2“.

## Kontext

Die Seite eines Zeitraums ([[spiegel-langzeit]]) braucht Zahlen über viele Scheiben:
- Werte je Scheibe aus der Registry
- Verlauf mit gleitendem Schnitt und Formband, Boden und Decke je Monat
- Trainingsumfang
- Vergleich zweier Zeiträume mit Urteil, „gegen den eigenen Schnitt“
- Rekorde

Heute rechnet der Fachkern nur über eine Scheibe. L2 fügt ihm reine Funktionen über eine Liste von Scheiben
hinzu, mit Tests nach Handwerten, Simulationen für jede Zahl in einem Hilfetext und Erklärungen in
`shot-help`. Oberfläche und Labor kommen in L3.

## Entscheidungen

- **D1 Eingabe:**
  - Eine Scheibe im Zeitraum ist `PeriodCard`: Kennung, Beginn, Training oder Wettkampf, endgültig und
    vollständig, Merkmale, dazu die Schüsse als `MetricShot`.
  - Die Disziplin-Familie filtert der Aufrufer, die Funktionen nehmen an, dass alle Scheiben einer Familie
    angehören.
  - Wochen, Monate und Tage ordnet der Aufrufer zu (`bucketOf`, `dayOf`), denn die Anzeige-Zeitzone liegt
    in der App. Der Fachkern bleibt ohne `Intl`.
- **D2 Gleitender Schnitt über die letzten fünf Scheiben**, nicht über 30 Tage: Bei unregelmäßigem Training
  stünde sonst mal eine, mal zwanzig Scheiben dahinter. Vor der fünften Scheibe heißt er „bisher“
  (`partial`), wie im Verlauf einer Scheibe.
- **D3 Formband:**
  - Gleitender Schnitt ± typische Schwankung. Die Schwankung ist robust: 1,4826 · MAD der Abweichungen der
    Scheiben vom gleitenden Schnitt, über alle Scheiben mit vollem Fenster.
  - Ab zehn Scheiben, sonst kein Band.
  - Bei einem gleichbleibenden Schützen liegen etwa zwei von drei Scheiben im Band; die Simulation B20 belegt
    den Anteil.
- **D4 Boden und Decke je Monat (T5):** P10, Median und P90 der Scheibenwerte. P10 und P90 erst ab fünf
  Scheiben im Monat, sonst nur der Median.
- **D5 Vergleich zweier Zeiträume (C3, T3):**
  - Einheit des Tests ist die Scheibe: Mann-Whitney auf den Scheibenwerten, zweiseitig, α 0,05.
  - Bis zu 20 Scheiben je Seite wird die Verteilung genau ausgezählt (Durchzählen der Rangsummen, auch bei
    gleichen Werten mit mittleren Rängen); darüber gilt die Normalnäherung mit Korrektur für gleiche Werte.
  - Der Unterschied ist die Differenz der Mittel.
  - Ein Urteil gibt es ab fünf Scheiben je Seite, sonst „zu wenige Scheiben“.
  - „Bedeutsam“ heißt: |Δ| ≥ 0,3 × Streuung der Scheibenwerte (gepoolt; Hopkins, T3).
  - Gewählt ist ein Rangtest statt Welch-t: Er braucht keine Normalverteilung und nur die Normalfunktionen,
    die es schon gibt. Die Simulation B19 belegt Fehlalarm und Trennschärfe.
- **D6 Gegen den eigenen Schnitt (C4):**
  - Die letzte Scheibe gegen den Schnitt der Scheiben aus den 30 Tagen davor (ohne sie selbst; ab drei
    Scheiben).
  - Dazu ihr Rang unter den letzten 50 Scheiben als Perzentil (ab zehn).
- **D7 Rekorde (R1–R8):**
  - **Was zählt:** nur endgültige, vollständige Scheiben, ohne die Merkmale `nur-pdf`, `neu-gewertet` und
    `ausgenommen` und ohne einen verdächtigen Schuss (SF-15, SF-66; die offene Frage aus SF-15 ist damit
    entschieden).
  - **Aufteilung:** je Wertung; wahlweise nur Training oder nur Wettkampf.
  - **Gleichstand:** Es gilt der frühere, denn er hat den Rekord gesetzt.
  - **Je Schusszahl:** R1, R4 (volle Scheibe), R5 und R6 werden je Schusszahl geführt; 40 und 60 Schuss sind
    nicht vergleichbar.
  - **R5:** nur noch „meiste 10,9“. Der beste Schuss ist der beste Teiler (R3), nach der Regel „keine Zahl,
    die aus einer anderen folgt“.
- **D8 Nur Probe (SF-01):**
  - Eine Scheibe nur mit Probe zählt nur mit der Option `includeProbeOnly`, dann aber in Verläufen,
    Vergleichen **und Rekorden**. Geändert auf Einwand des Users, 8. Oktober 2026: Auch im Training kann ein
    Rekord fallen.
  - Sie rechnet dann über ihre Probeschüsse wie Wertung: in Abgabefolge, in Serien zu zehn, wie
    `probeOnlyAsMatch` auf der Seite einer Scheibe.
  - Ohne die Option zählt sie nirgends.
- **D9 Trainingsumfang (T6):** Schüsse, Scheiben und Tage je Woche. Keine Netto-Zeit: Sie folgt aus den
  Abständen (Regel in `packages/shot-core/CLAUDE.md`).

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/stats.ts` | `mannWhitney` (genau bis 20 je Seite, sonst Normalnäherung), `normalTwoSided` |
| `packages/shot-core/src/stats.test.ts` | Tests nach Hand und gegen Durchzählen |
| `packages/shot-core/src/analysis/period.ts` | neu: `PeriodCard`, `cardValues`, `periodTrend`, `periodBuckets`, `trainingVolume`, `comparePeriods`, `againstOwnAverage` |
| `packages/shot-core/src/analysis/period.test.ts` | neu |
| `packages/shot-core/src/analysis/records.ts` | neu: `recordEligible`, `periodRecords` |
| `packages/shot-core/src/analysis/records.test.ts` | neu |
| `packages/shot-core/src/analysis/index.ts`, `catalog.ts` | Export und Katalog-IDs |
| `packages/shot-help/scripts/simulate.ts` | B19 (Vergleich), B20 (Formband) |
| `packages/shot-help/src/types.ts`, `markdown.ts`, `topics.ts`, `topics.test.ts` | Thema `period` „Über viele Scheiben“ mit fünf Erklärungen |
| `vault/spiegel/spiegel-statistics.md`, `vault/spiegel/spiegel-statistics-help.md` (erzeugt) | Katalogzeilen, Belege |
| `vault/spiegel/spiegel-langzeit.md`, `vault/spiegel/spiegel-roadmap.md`, `packages/shot-core/CLAUDE.md` | Doku |

## Required Docs

- `packages/shot-core/CLAUDE.md` (alle Regeln, besonders „Ehrlich statt scheingenau“, „Auswertungen wählen wie
  die Registry“, „Neue Auswertung, neuer Katalog-Eintrag“, „Simulation nachziehen“, Testwerte von Hand)
- `packages/shot-help/CLAUDE.md`, `vault/spiegel/spiegel-statistics.md` (Abschnitte 8–10, „Ehrliche Zahlen“)
- `vault/spiegel/spiegel-metrics.md` („Verläufe“, „Direkte Vergleiche“, „Vergleichbarkeit und Robustheit“)
- `vault/conventions.md` §9

## Aufgaben

### Task 1: Mann-Whitney im Statistik-Modul (Tests zuerst)

```ts
/** zweiseitiger p-Wert zu z unter der Standardnormalverteilung */
export function normalTwoSided(z: number): number
/**
 * Mann-Whitney-U für zwei unabhängige Gruppen, zweiseitig. Bis 20 Werte je Seite genau: die Verteilung der
 * Rangsumme von `a` über alle Aufteilungen der gemeinsamen (mittleren) Ränge, durchgezählt; darüber
 * Normalnäherung mit Korrektur für gleiche Werte und Stetigkeitskorrektur. Unter einem Wert je Seite null.
 */
export function mannWhitney(
  a: readonly number[],
  b: readonly number[]
): { u: number; p: number; exact: boolean } | null
```

- **Genau:**
  - Ränge mit mittleren Rängen für gleiche Werte.
  - Doppelte Ränge als ganze Zahlen, dann Durchzählen über die Auswahl von |a| aus allen Werten: Tabelle
    `count[k][s]` über Elemente, Größe k und Summe s.
  - p = Anteil der Aufteilungen, deren Abstand der Rangsumme zum Erwartungswert mindestens so groß ist wie
    der beobachtete.
- **`normalTwoSided`:** p = erfc(|z|/√2). `stats.ts` hat bisher keine Normalverteilung; Mann-Kendall
  vergleicht z nur mit `Z95`. Neu ist deshalb `erfc` nach Numerical Recipes, `erfcc`:
  - t = 1/(1 + 0,5·|x|)
  - erfc = t·exp(−x² − 1,26551223 + t(1,00002368 + t(0,37409196 + t(0,09678418 + t(−0,18628806 + t(0,27886807
    + t(−1,13520398 + t(1,48851587 + t(−0,82215223 + t·0,17087277)))))))))
  - Fehler unter 1,2·10⁻⁷, für x < 0 gilt 2 − erfc(−x).
  - Die Quelle steht im Kommentar.
- **Tests in `stats.test.ts`:**
  - **Getrennt:** a = [1, 2, 3], b = [4, 5, 6] → U 0, p = 2/20 = 0,1, `exact`.
  - **Fünf gegen fünf getrennt:** p = 2/252 = 0,0079365.
  - **Gleiche Werte:** a = [1, 2, 2], b = [2, 3, 4] → p gleich dem Wert aus einem Durchzählen im Test (alle 20
    Aufteilungen der sechs Werte, eigene kleine Funktion im Test, nicht die Implementierung).
  - **Normalnäherung:** 21 gegen 21 Werte, a = 1…21, b = 1,5 … 21,5 (jeweils +0,5), ohne gleiche Werte.
    `exact` ist false; p entspricht `normalTwoSided` mit dem von Hand berechneten z:
    - Uₐ = Σ(i − 1) = 210, U_b = 231
    - Erwartung 220,5, Varianz 21·21·43/12 = 1580,25
    - z = (10,5 − 0,5)/39,7524 = 0,25156, also p = 0,80138 (auf 1e-4)
  - `normalTwoSided(1,959964)` ≈ 0,05 auf 1e-6; `normalTwoSided(0)` = 1.
  - Leere Seite → null.

### Task 2: Werte je Scheibe und Verlauf (T1, T2)

`analysis/period.ts`:

```ts
export interface PeriodCard {
  /** stabile Kennung der Scheibe (Rekord und Weg zur Scheibe) */
  id: string
  /** Beginn in ms (UTC) */
  startedAtMs: number
  kind: "training" | "competition"
  /** endgültig und mit voller Schusszahl (SF-66): nur dann für Rekorde */
  complete: boolean
  /** Merkmale der Scheibe, etwa "nur-pdf", "neu-gewertet", "ausgenommen" */
  flags?: readonly string[]
  shots: readonly MetricShot[]
}

export interface CardValue { id: string; atMs: number; value: number; n: number }

/**
 * Wert einer Registry-Kennzahl je Scheibe (T1), in Abgabefolge der Scheiben (`startedAtMs`, bei Gleichstand
 * die Kennung), über die Wertungsschüsse; eine Scheibe nur mit Probe nur mit `includeProbeOnly`, dann über die
 * Probe. Ohne Wert (Mindestzahl, fehlende Angaben) fällt die Scheibe weg. `n` = Schüsse, die zählen
 * (`eligibleShots`), für Maße, die an der Schusszahl hängen.
 */
export function cardValues(
  cards: readonly PeriodCard[],
  metric: MetricDefinition,
  scoring: Scoring,
  options?: { includeProbeOnly?: boolean }
): CardValue[]

export interface TrendPoint extends CardValue {
  /** Schnitt der letzten fünf Scheiben bis hierher; `partial`, solange es noch keine fünf sind */
  mean: number
  partial: boolean
  /** Formband: Schnitt ± typische Schwankung; null unter zehn Scheiben */
  band: { low: number; high: number } | null
}
/** Verlauf mit gleitendem Schnitt (T1) und Formband (T2, D2, D3) */
export function periodTrend(values: readonly CardValue[], window = 5): {
  points: TrendPoint[]
  /** 1,4826 · MAD der Abweichungen vom vollen Schnitt; null unter zehn Werten */
  spread: number | null
}
```

`MetricDefinition` und Hilfen kommen aus `../metrics`. Die Kennzahl geht mit `inScoring(metric, scoring)` durch
`computeMetric`.

Tests in `period.test.ts` (eigener Baukasten `card(id, day, values)` mit Zehntelwerten und `startedAtMs = day ·
86 400 000`):
- **`cardValues` mit `result.decimalMean`:**
  - Drei Scheiben mit Werten [100, 100], [90, 92] und [95] → 10,0 / 9,1 / 9,5, sortiert nach Beginn, auch bei
    vertauschter Eingabe.
  - Eine Scheibe nur mit Probe fehlt, mit `includeProbeOnly` ist sie dabei.
  - Mit `result.ringsMean` gelten die ganzen Ringe.
- **`periodTrend` über die Werte 9, 10, 8, 10, 9, 11, 9, 10, 8, 10, 9, 10:**
  - Schnitt an Stelle 3: 9 `partial`; an Stelle 5: 9,2 voll; an Stelle 6: 9,6.
  - Die vollen Schnitte an den Stellen 5 bis 12 sind 9,2 / 9,6 / 9,4 / 9,8 / 9,4 / 9,6 / 9,2 / 9,4. Die
    Abweichungen sind −0,2 / 1,4 / −0,4 / 0,2 / −1,4 / 0,4 / −0,2 / 0,6, ihr Median 0, der MAD 0,4.
  - Damit gilt: `spread` = 0,59304, `band` an Stelle 12 von 9,4 − 0,59304 bis 9,4 + 0,59304.
  - Unter zehn Werten ist `spread` null und `band` null.

### Task 3: Boden, Decke, Umfang (T5, T6)

```ts
/** je Zeitraum-Abschnitt (Woche, Monat; `bucketOf` vom Aufrufer): Zahl, Median, P10 und P90 (ab fünf Werten) */
export function periodBuckets(values: readonly CardValue[], bucketOf: (atMs: number) => string): {
  key: string; n: number; median: number; p10: number | null; p90: number | null
}[]
/** Trainingsumfang je Abschnitt (T6): Schüsse (Probe und Wertung), Scheiben, Tage (`dayOf`) */
export function trainingVolume(
  cards: readonly PeriodCard[],
  bucketOf: (atMs: number) => string,
  dayOf: (atMs: number) => string
): { key: string; shots: number; cards: number; days: number }[]
```

Abschnitte stehen in der Reihenfolge ihres ersten Werts. Quantile kommen aus `quantile` (`stats.ts`). Tests mit
`bucketOf = (ms) => String(Math.floor(ms / (7 · 86 400 000)))`:
- Zwei Wochen, eine mit sechs Werten 1…6: Median 3,5, P10 1,5, P90 5,5 (Typ 7 wie `quantile`: h = 5·0,1 =
  0,5 → 1 + 0,5).
- Eine Woche mit drei Werten: P10 und P90 sind null.
- Umfang: zwei Scheiben am selben Tag und eine an einem anderen, in derselben Woche → Tage 2, Scheiben 3,
  Schüsse gleich der Summe.

### Task 4: Vergleich und eigener Schnitt (C3, T3, C4)

```ts
export interface PeriodComparison {
  a: { n: number; mean: number }
  b: { n: number; mean: number }
  /** Mittel b − Mittel a */
  delta: number
  /** Mann-Whitney über die Scheibenwerte; null unter fünf Scheiben je Seite */
  test: { p: number; exact: boolean } | null
  /** „höher“, „tiefer“ oder „unklar“ (p ≥ 0,05 oder zu wenige Scheiben) */
  verdict: "higher" | "lower" | "unclear"
  /** |Δ| ≥ 0,3 × gepoolte Streuung der Scheibenwerte (T3); null unter fünf je Seite */
  meaningful: boolean | null
}
export const MIN_CARDS_PER_SIDE = 5
export function comparePeriods(a: readonly CardValue[], b: readonly CardValue[]): PeriodComparison | null
/** die letzte Scheibe gegen den Schnitt der 30 Tage davor (C4, D6) und ihr Perzentil unter den letzten 50 */
export function againstOwnAverage(values: readonly CardValue[]): {
  last: CardValue
  /** Schnitt der Scheiben aus den 30 Tagen davor, ohne die letzte; null unter drei */
  average: { n: number; mean: number; delta: number } | null
  /** Anteil der letzten 50 (mit ihr) mit kleinerem Wert, gleiche zur Hälfte; null unter zehn */
  percentile: number | null
} | null
```

- **„Höher“ und „tiefer“** beschreiben die Zahl. Ob das besser ist, sagt die Oberfläche über `metric.better`.
- **Gepoolte Streuung:** √(((nₐ − 1)sₐ² + (n_b − 1)s_b²) / (nₐ + n_b − 2)).
- **Tests:**
  - Getrennte Gruppen 5 gegen 5 → `verdict` „higher“, p 0,0079, `meaningful` true.
  - Gleiche Werte auf beiden Seiten → „unclear“, Δ 0.
  - Vier Scheiben auf einer Seite → `test` null, „unclear“.
  - **Kleiner, aber klarer Unterschied:** aᵢ = 9,5 + 0,001·i und bᵢ = aᵢ + 0,05 (i = 0…19), vollständig
    getrennt. Das ergibt „higher“, `exact` true, und `meaningful` true, denn s = 0,0059 und
    0,3·s < 0,05.
  - **Große Streuung:** a = [8, 9, 10, 11, 12] und b = a + 0,1. Das ergibt Δ 0,1, s 1,58 und 0,3·s = 0,47,
    also `meaningful` false und „unclear“.
  - `againstOwnAverage`, letzte Scheibe an Tag 40:
    - Die Scheiben an den Tagen 5, 15 und 39 zählen nur mit 15 und 39 (30 Tage davor), das ergibt n 2 und
      damit `average` null.
    - Mit einer weiteren Scheibe an Tag 20 ist n 3.
    - Das Perzentil für die zwölf Werte aus Task 2 (die letzte ist 10): sechs Werte sind kleiner, fünf gleich
      (mit ihr), also (6 + 0,5·5)/12 = 0,70833.

### Task 5: Rekorde (R1–R8)

`analysis/records.ts`:

```ts
export const RECORD_EXCLUDING_FLAGS = ["nur-pdf", "neu-gewertet", "ausgenommen"] as const
/** zählt die Scheibe für Rekorde (D7)? */
export function recordEligible(card: PeriodCard): boolean
export interface RecordRef { value: number; cardId: string; atMs: number; detail?: string }
export interface PeriodRecords {
  /** R1: bestes Ergebnis je Schusszahl der Wertung (Schlüssel: Schusszahl) */
  bestCard: Readonly<Record<number, RecordRef>>
  /** R2: beste Serie voller Länge (die häufigste Serienlänge der Scheibe), detail „Serie 3“ */
  bestSeries: RecordRef | null
  /** R3: bester Teiler (kleinster), detail „Schuss 17“ */
  bestTeiler: RecordRef | null
  /** R4: engste Gruppe (Streukreis in µm) über eine volle Serie zu zehn, und je Schusszahl über die volle Scheibe */
  tightestSeries: RecordRef | null
  tightestCard: Readonly<Record<number, RecordRef>>
  /** R5: meiste 10,9 je Schusszahl (nur in Zehnteln; in ganzen Ringen leer) */
  mostPerfect: Readonly<Record<number, RecordRef>>
  /** R6: meiste Zehner und Innenzehner je Schusszahl */
  mostTens: Readonly<Record<number, RecordRef>>
  mostInnerTens: Readonly<Record<number, RecordRef>>
  /** R7: längste Folge von Zehnern (`longestRun`, Schwelle 100 Zehntel) */
  longestTenRun: RecordRef | null
  /** R8: beste Form: höchster voller Schnitt über fünf Scheiben (Ø je Schuss, `periodTrend`) */
  bestForm: RecordRef | null
}
export function periodRecords(
  cards: readonly PeriodCard[],
  scoring: Scoring,
  options?: { kind?: PeriodCard["kind"]; includeProbeOnly?: boolean }
): PeriodRecords
```

- Werte kommen aus der Registry (`result.decimal` bzw. ganze Ringe über `inScoring`, `result.tens`,
  `result.innerTens`, `group.enclosingDiameter`) und aus `seriesCurve`, `shotExtremes` und `longestRun`. Es
  gibt keine eigene Rechnung, nur Auswahl und Vergleich.
- Gleichstand: Es gilt der frühere (`atMs`, dann `id`).
- **Tests:**
  - Ausschluss je Merkmal, ohne `complete` und mit einem verdächtigen Schuss.
  - R1 getrennt für 40 und 60 Schuss.
  - Gleichstand: der frühere.
  - R2 ignoriert eine kurze Restserie.
  - R3 ohne verdächtige Schüsse.
  - R5 in ganzen Ringen leer.
  - R7 über zwei Scheiben, die längere Folge.
  - R8 erst ab fünf Scheiben.
  - `kind: "competition"` filtert.
  - Eine Trainingsscheibe nur mit Probe zählt ohne die Option nicht. Mit `includeProbeOnly` setzt sie den
    besten Teiler, und ihre zweite Zehnergruppe gilt als Serie 2.
  - Alle Erwartungen sind aus kleinen, von Hand gebauten Scheiben abgeleitet.

### Task 6: Export und Katalog

- **`analysis/index.ts`:** `export * from "./period"` und `export * from "./records"`.
- **`ANALYSIS_CATALOG`**, Abschnitt „Über viele Scheiben“:
  - `cardValues: ["T1"]`, `periodTrend: ["T1", "T2"]`, `periodBuckets: ["T5"]`, `trainingVolume: ["T6"]`
  - `comparePeriods: ["C3", "T3"]`, `againstOwnAverage: ["C4"]`
  - `recordEligible: ["R1"]`, `periodRecords: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]`
- **Gate:** Der Katalog-Test ist grün. Der Hilfe-Test wird rot, bis Task 8 die Erklärungen bringt. Deshalb
  kommen Task 6 und Task 8 in **einen** Commit; dazwischen nicht committen.

### Task 7: Simulationen B19 und B20

In `packages/shot-help/scripts/simulate.ts` (mit dem Edit-Werkzeug):

- **B19, Vergleich zweier Zeiträume:**
  - Je Scheibe 40 Schuss Luftgewehr (σ 1,5 mm), Wert Ø je Schuss in Zehnteln über `cardValues`.
  - Fehlalarm bei gleichem σ: 5/5, 10/10 und 20/20 Scheiben, Anteil „higher“ oder „lower“.
  - Trennschärfe bei σ 1,5 → 1,3 mm auf Seite b: Anteil „higher“.
  - Dazu der Anteil „bedeutsam“ in beiden Fällen.
  - 2 000 Wiederholungen je Fall, feste Seeds 19 000 + n.
- **B20, Formband:** 60 Scheiben eines gleichbleibenden Schützen. Anteil der Scheiben ab der zehnten, die im
  Band liegen, als Median über 2 000 Wiederholungen.
- **Abnahme (Breaker):**
  - B19 Fehlalarm bei allen Größen ≤ 5,5 %. Der genaue Test ist ≤ 5 %; die Normalnäherung kommt erst ab 21
    zum Zug.
  - B20 zwischen 55 und 80 %.
  - Verfehlt: HALT, die Entscheidung geht an den User.

### Task 8: Erklärungen in `shot-help`

- **Typen und Darstellung:**
  - `HelpTheme` um `"period"` erweitern.
  - `THEME_TITLES.period = "Über viele Scheiben"`, `THEME_ORDER` am Ende ergänzen.
- **Fünf Themen** in `topics.ts`, Stil wie die übrigen: du, einfache Sprache, Zahlen nur aus B19 und B20.
  - `verlauf-und-form` (T1, T2, T5): Werte je Scheibe, Schnitt der letzten fünf, Formband, Boden und Decke je
    Monat. Hinweis: Streukreis und andere Maße, die an der Schusszahl hängen, nur bei gleicher Schusszahl,
    sonst σ.
  - `trainingsumfang` (T6): Schüsse, Scheiben, Tage je Woche; keine Netto-Zeit.
  - `zeitraum-vergleich` (C3, T3): Einheit ist die Scheibe; Urteil ab fünf je Seite; „bedeutsam“; Fehlalarm
    und Trennschärfe aus B19.
  - `gegen-den-schnitt` (C4): letzte Scheibe gegen 30 Tage davor; Perzentil unter den letzten 50.
  - `rekorde` (R1–R8): was zählt (D7), je Schusszahl, Gleichstand.
- **`topics.test.ts`:** Die Zahl der Themen steigt von 24 auf 29, der Name des Tests wird angepasst.
- **Leitfaden:** `pnpm --filter @vereinsheim/shot-help run docs`, dann `test`.
- **Commit** zusammen mit Task 6.

### Task 9: Katalog und Doku

- **`vault/spiegel/spiegel-statistics.md`:**
  - Zeilen T1, T2, T3, T5, T6, C3, C4, R1–R9 nachziehen: Definition wie umgesetzt (D2–D9), „Wo“ um „Fachkern
    L2“ ergänzt.
  - R5 heißt „meiste 10,9“.
  - Der Block „Belege aus Simulationen“ bekommt B19 und B20, die Stand-Zeile „Zeiträume (8. Oktober 2026)“.
- **`vault/spiegel/spiegel-langzeit.md`:** L2 erledigt, mit Verweis auf D2–D9.
- **`vault/spiegel/spiegel-roadmap.md`:** SP-2.1 und SP-2.2 „Fachkern erledigt (L2), Oberfläche mit L3“.
- **`packages/shot-core/CLAUDE.md`:** Die Exportzeile `analysis` nennt Zeiträume und Rekorde. Dazu eine Regel:
  „Über viele Scheiben: Einheit ist die Scheibe (Werte je Scheibe, Tests über Scheiben); Familie und Zeitzone
  wählt der Aufrufer.“

## Teststeps

- Task 1: Die Tests von `mannWhitney` sind vor der Umsetzung rot (Funktion fehlt), danach grün.
- Task 2–5: Jede Funktion zuerst mit Tests nach Handwerten. Gegenproben:
  - gleitender Schnitt über vier statt fünf → Test rot
  - Spread ohne 1,4826 → rot
  - Rekorde ohne Ausschluss verdächtiger Schüsse → rot
  - Vergleich über alle Schüsse statt Scheiben → rot (eigener Test: zwei Scheiben mit vielen Schüssen gegen
    viele Scheiben mit wenigen)
- Gate nach jedem Task; Task 6 und 8 als ein Commit.

## Verification

- `pnpm check` grün; shot-core und shot-help Tests grün.
- Simulation mit den Abnahmen aus Task 7.
- `vault-lint` valide.
- Bericht `reports/2026-10-08-spiegel-zeitraum-kern.md`.
- **Nicht in L2:** Oberfläche, Labor-Saison, Langzeit-Trefferbild (L3, L4).
