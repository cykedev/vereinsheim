# 2c · Auswertung im Tagebuch: Einflüsse, Selbstbild, Vorschau mit den Daten des Users

Teilplan von Stufe 2 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`,
`89726320`), Kindsession `tis-2c-diary-analysis`, Branch `feat/tis-2c-diary-analysis` vom Basisbranch. Entscheidungen im
Koordinationsplan unter „Designkonzept 2c, Runde 2“ (vom User am 29. Oktober 2026 mit allen Empfehlungen freigegeben,
Artifact https://claude.ai/artifact/PuQTCAECDnDYxBjMLPjMUe), Regeln in [[adr-033]], [[adr-034]] und [[spiegel-diary]].
Parallel läuft der Teil „Reiter“ nach `main` (gemeinsamer Baustein `@vereinsheim/ui/design2/tab-bar`).

## Kontext

Treffsicher 2.0 für Statistik: Einflüsse und Selbstbild ziehen ins Tagebuch (ADR-033: „Einflüsse und Selbstbild liegen
im Tagebuch. Sie nehmen die Werte aus Spiegels Fachkern“). Grundlage des Konzepts (Prod-Kopie, nur Zahlen): 36 Einheiten
mit Befinden und Ergebnis in 4 Konten (26 in einem, in 90 Tagen nie mehr als 9), 180 bewertete Serien an 48 Einheiten,
10 Einheiten mit Prognose und Feedback (höchstens 4 je Konto).

**Zählungen für das größte Konto** (das Treffsicher-Konto mit den meisten Einheiten; dieselbe E-Mail gibt es in
Spiegel; Dev-DB vom 29. Oktober 2026, nur Zahlen; Abend = Tag in Europe/Berlin, vor 4 Uhr der Vortag; Spiegel-Scheiben
sichtbar: nicht gelöscht, nicht wartend, Disziplin nicht ignoriert):

- **Treffsicher:** 94 Einheiten (81 Training, 13 Wettkampf), alle Disziplin „Luftpistole“ (System, ganze Ringe, 4 × 10,
  keine Probeserie). 92 mit Ergebnis, 86 mit Einzelschüssen in jeder Wertungsserie (immer 10 Schuss, ganze Ringe), 88 mit
  Trefferlage (mm und Richtung). Serienzahl je Einheit: 86 × 4, 3 × 6, 2 × 5, 2 × 2, 1 × 0. 5 Abende mit zwei Einheiten.
  26 mit Befinden, 32 mit bewerteten Serien (129 Wertungsserien, Werte 1 bis 5, davon in 6 Einheiten alle gleich
  bewertet), 4 mit Prognose und Feedback, 3 mit erwartetem Ergebnis. 3 Ziele, 2 Abläufe, 2 Anhänge, 11 Reflexionen.
- **Spiegel, Familie Luftpistole (Wertung des Kontos: ganze Ringe):** 111 Scheiben an 77 Abenden (62 von der Brücke,
  49 vom Ausdruck). **56 sind „nur Probe“**, davon 46 der 49 Scheiben vom Ausdruck (meist 40 Schuss: Training, im
  Probe-Modus gedruckt) und 10 von der Brücke (7 × 40 Schuss, 3 × 10 Schuss Probe vor einer Wertung). 49 Abende haben nur
  Scheiben „nur Probe“, 28 eine Wertung.
- **Einheit ↔ Spiegel-Abend derselben Familie:**

  | Einheiten                | gesamt | Abend mit Wertung | Abend nur mit „nur Probe“ | ohne Scheibe in Spiegel |
  | ------------------------ | -----: | ----------------: | ------------------------: | ----------------------: |
  | alle                     |     94 |                17 |                        52 |                      25 |
  | mit Befinden             |     26 |                 4 |                         8 |                      14 |
  | mit bewerteten Serien    |     32 |                 4 |                        10 |                      18 |
  | mit Prognose und Feedback |     4 |                 1 |                         1 |                       2 |
  | mit erwartetem Ergebnis  |      3 |                 1 |                         0 |                       2 |

  Von den 25 ohne Scheibe haben 24 ein Ergebnis (17 Training, 7 Wettkampf; 23 mit 4 Serien, 1 mit 2), 19 davon
  Einzelschüsse in jeder Serie, 20 eine Trefferlage. Das Werkzeug legt also 24 Scheiben „aus Treffsicher“ an. Die 5 Abende
  mit zwei Einheiten haben alle eine Spiegel-Scheibe, keine dieser Einheiten hat Befinden, Ausführung oder Erwartung.
- **Nach dem Werkzeug** (Probe nach der Abend-Regel unten): alle 26 Einträge mit Befinden haben eine Scheibe und fünf
  Scheiben davor; ohne „nur Probe“ wären es 18 (8 fallen weg). Von den 32 Einheiten mit Ausführung landen 18 auf einer
  neuen Scheibe, 2 auf der einen Wertung des Abends, 8 auf der einen Scheibe „nur Probe“, 4 bleiben ohne (mehrere
  Scheiben am Abend).
- **Vorschau-Daten heute in der Dev-DB:** 94 `DiaryEntry` mit `preview:<Einheit>` (alle für dieses Konto, alle mit
  Disziplin; 26 × 4 Werte Befinden, 4 × 7 Prognose, 4 × 7 Feedback, 3 mit erwartetem Ergebnis, 4 Ausführungen an 1 Eintrag,
  keine Verknüpfung mit Scheiben, 1 Eintrag nach dem Anlegen geändert). 10 `DiaryGoal` (`preview:2b-goal-…`) und
  2 `DiaryRoutine` (`preview:2b-routine-…`) sind erfundene Prüffälle aus 2b, nicht aus Treffsicher. Eine Scheibe mit Herkunft
  `treffsicher` gibt es schon (`treffsicher:demo-…` aus `seed:own --demo`).

2c baut: den fünften Reiter „Auswertung“ (Einflüsse, Selbstbild, Seite eines Merkmals), die Hilfe dazu, das
Vorschau-Werkzeug für die Dev-DB, die Skriptprüfung, die Datenprüfung mit den Daten des Users, Vault und den Nachtrag zu
ADR-033. **Kein Schema-Change, keine Migration:** alles wird beim Lesen gerechnet.

## Schnitt

Ein Plan, ein Branch, vier Teile in dieser Reihenfolge:

- **Teil A · Rechnung:** Schnittstelle `resultFormCards`, reine Funktionen (Teilung am Median, Form und Abstand,
  Einflüsse, Ausführung, Selbstbild), Texte.
- **Teil B · Seiten:** Reiter, `/diary/analysis`, `/diary/analysis/[factor]`, Hilfe.
- **Teil C · Vorschau-Werkzeug:** Zuordnung Treffsicher → Scheibe und → Eintrag, Ablauf als Nahtstelle, CLI.
- **Teil D · Prüfung, Doku, Übergabe:** Skriptprüfung, Vault und ADR-033, Umstellung auf `TabBar`, Datenprüfung mit den
  Daten des Users, `/validate`, `/review`.

## Ansatz

### Grenze

- Seiten und Rechnung liegen in der Zone Tagebuch (`src/diary/analysis/**`, `src/diary/components/**`,
  `src/app/(app)/diary/analysis/**`). Scheiben liest das Tagebuch nur über `src/lib/results-read.ts`: dazu kommt
  `resultFormCards` (Ø je Schuss und Serien der Projektion je Scheibe einer Familie), ohne Wissen über das Tagebuch.
- Das Werkzeug schreibt beide Teile. Seine wiederverwendbare Logik steht deshalb so, dass das Gate sie sieht
  (`boundary.test.ts` liest nur `src/`, `tools/` nicht): Zuordnung zur Scheibe im Ergebnisteil
  (`src/lib/transfer/treffsicher-card.ts`), Zuordnung zum Eintrag und Schreiben im Tagebuch
  (`src/diary/transfer/`), der Ablauf über beide als Nahtstelle (`src/parts/transfer/diary-preview.ts`). `tools/diary-preview.ts`
  ist nur die Kommandozeile. Stufe 3 nimmt dieselben Module.
- `boundary.test.ts` bekommt keine neue Ausnahme.

### Welche Scheiben zählen (Abend-Regel für „nur Probe“)

Eine reine Funktion `countedCards` in `src/diary/analysis/form.ts`: Je Abend und Familie zählen die Scheiben mit Wertung;
hat ein Abend keine Wertung, zählen seine Scheiben „nur Probe“ (ein Training, im Probe-Modus gedruckt). So zählen die
46 Trainings vom Ausdruck, und die kurzen Probe-Blöcke vor einer Wertung (Brücke) bleiben draußen. Gilt für die Form, den
Wert eines Eintrags und die Ausführung. Offener Punkt 1.

### Schnittstelle `resultFormCards`

In `apps/spiegel/src/lib/results-read.ts`:

```ts
/** eine eigene Scheibe einer Familie, wie die Auswertung des Tagebuchs sie braucht; Werte in der Wertung der Familie */
export interface FormCard {
  id: string
  /** der Abend (ISO-Tag, vor 4 Uhr der Vortag) */
  day: string
  startedAtMs: number
  kind: OverviewCard["kind"]
  probeOnly: boolean
  /** Ø je Schuss (`result.decimalMean` bzw. `result.ringsMean`) mit Schusszahl und Streuung der Schusswerte; null ohne */
  mean: { value: number; n: number; sd?: number | null } | null
  /** die Serien der Projektion mit Ø je Schuss in der Wertung der Familie; null vor Projektion 7 */
  series: { series: number; shots: number; mean: number | null }[] | null
}

/** alle sichtbaren eigenen Scheiben einer Familie in zeitlicher Folge und die Wertung der Familie */
export async function resultFormCards(
  db: Db,
  query: { ownerId: string; familyId: number; timeZone: string }
): Promise<{ scoring: Scoring; cards: FormCard[] }>
```

- Gelesen über `overviewCards` (wie `resultCards`), gefiltert auf `familyId`, sortiert nach `startedAtMs` (bei
  Gleichstand `id`, wie `byStart`). `scoring = scoringOf(slug)`. `mean` aus
  `projection.values[inScoring(metricByKey("result.decimalMean"), scoring).key]` (`value`, `n`, `sd` wie
  `projectedValues`), auch für „nur Probe“ (die Projektion rechnet sie über die Probe). `series` aus `seriesOfCards`:
  `mean = (scoring === "rings" ? rings : decimal) / shots`, null ohne Wert oder bei `shots` 0.
- Test in `results-read.test.ts` gegen die Dev-DB mit eigener Anlage: drei Scheiben der Familie (eine „nur Probe“, eine
  aus Summen ohne `sd`), eine einer anderen Familie, eine im Papierkorb → genau die drei, in zeitlicher Folge; `mean`
  gleich `projectedValues(...)[i]` mit `includeProbeOnly: true`; `series[0].mean` gleich Serien-Summe durch Schusszahl.

### Form und Abstand (`src/diary/analysis/form.ts`)

```ts
/** je Abend die Scheiben mit Wertung, an einem Abend ohne Wertung die „nur Probe“ */
export function countedCards<T extends { day: string; probeOnly: boolean }>(cards: readonly T[]): T[]

/**
 * Die Form vor einem Abend: Schnitt über die Schüsse der fünf letzten gezählten Scheiben mit Wert vor diesem Abend
 * (`DELTA_WINDOW`, `pooledValue` wie der Abstand in der Liste und der Schnitt der letzten fünf im Fortschritt); null unter
 * fünf
 */
export function formBefore(counted: readonly FormCard[], day: string, scoring: Scoring): number | null

/**
 * Der Wert eines Eintrags: Ø je Schuss über die Schüsse seiner gezählten Scheiben (`pooledValue`), Schüsse, Streuung der
 * Schusswerte um das Mittel des Eintrags (aus `sd` und Mittel je Scheibe; fehlt sie an einer Scheibe, fehlt sie); null
 * ohne Scheibe mit Wert
 */
export function entryValue(cards: readonly FormCard[], scoring: Scoring): { value: number; n: number; sd?: number | null } | null

/** der Abstand zur Form als Wert für `compareValues`: Wert − Form, Schüsse und Streuung des Eintrags */
export function formDistance(
  entry: { id: string; startedAtMs: number },
  value: NonNullable<ReturnType<typeof entryValue>>,
  form: number
): CardValue
```

- Die Fünf vor dem Abend sind die letzten fünf gezählten Scheiben mit `day < entry.day` derselben Familie, auch vor dem
  gewählten Zeitraum und auch Scheiben anderer Einträge (wie `deltasBefore`: „auch außerhalb des Zeitraums“). Scheiben
  desselben Abends zählen nie zur Form.
- Streuung des Eintrags über mehrere Scheiben: `s² = (Σ (nᵢ − 1) sdᵢ² + Σ nᵢ (mᵢ − m)²) / (N − 1)`. Das Abziehen der Form
  (eine Zahl je Eintrag) ändert die Streuung nicht. So urteilt `compareValues` über Schüsse und Abende (ADR-034); fehlt
  einer Seite die Streuung (Scheibe nur aus Summen), nimmt `compareValues` selbst den Rangtest über die Einträge.
- Wiederverwendet: `DELTA_WINDOW` aus `@vereinsheim/shot-ui/period/model`, `pooledValue`, `inScoring`, `metricByKey`.
  Eine eigene Fensterrechnung ist nötig, weil `deltasBefore` je Scheibe rechnet: Bei zwei Scheiben an einem Abend stünde
  die erste im Fenster der zweiten. Die Gegenprobe im Test zeigt, dass beide bei einer Scheibe je Abend gleich rechnen.
- Tests (`form.test.ts`): `countedCards` (Abend mit Wertung und Probe-Block → nur Wertung; Abend nur mit Probe → die
  Probe); `formBefore` mit vier Scheiben → null, mit sechs → die letzten fünf, Scheibe am selben Abend zählt nicht;
  **Gegenprobe:** je Scheibe ein Abend, `formDistance(...).value` gleich `deltasBefore(values, ids, DELTA_WINDOW,
  pooledAverage).get(id).delta` (Toleranz 1e-9); Streuung zweier Scheiben gegen die Streuung der zusammengelegten
  Einzelwerte; Mutationsprobe (`<` → `<=` beim Tag, ein Test wird rot), conventions §9.

### Einflüsse (`src/diary/analysis/split.ts`, `influences.ts`)

- `splitAtMedian<T>(items, valueOf): { high: T[]; low: T[] }`: über und unter dem Median, die auf dem Median zur
  kleineren Gruppe, bei gleich großen zu keiner (wie `splitAtMedian` in
  `apps/treffsicher/src/lib/statistics/influences.ts`, dort an `InfluenceEntry` gebunden). Tests übernehmen die Fälle von
  Treffsicher (Werte auf einer Stufe, alle gleich → beide leer, gerade Zahl), dazu eine Mutationsprobe (die Regel „zur
  kleineren Gruppe“ durch „zu keiner“ ersetzt, ein Test wird rot).
- Merkmale: `WELLBEING_ASPECTS = SCALE_ASPECTS.wellbeing` (Schlaf, Energie, Stress, Motivation), Werte 0 bis 100 wie
  gespeichert (übernommene bleiben genau).

```ts
export const DISTANCE: MetricDefinition // { ...metricByKey("result.decimalMean"), key: "diary.formDistance", scoring: undefined }

export interface InfluenceInput {
  entryId: string
  day: string
  competition: boolean
  distance: CardValue
  wellbeing: Partial<Record<WellbeingAspect, number>>
}
export interface InfluencePoint {
  entryId: string
  day: string
  competition: boolean
  value: number
  distance: number
  side: "high" | "low" | "none"
}
export interface InfluenceRow {
  aspect: WellbeingAspect
  /** Einträge mit Wert in diesem Merkmal, die zählen */
  entered: number
  high: { n: number; mean: number | null }
  low: { n: number; mean: number | null }
  /** a die niedrige, b die hohe Gruppe; null, wenn eine Gruppe leer ist */
  comparison: PeriodComparison | null
  points: InfluencePoint[]
}
export function influenceRows(inputs: readonly InfluenceInput[]): InfluenceRow[]
```

- `DISTANCE` ist Ø je Schuss ohne Wertung: `pooledValue` mittelt dann genau (Σ vᵢnᵢ / Σ nᵢ), ohne Raster, denn ein
  Abstand liegt nicht auf dem Raster der Zehntel. `compareValues(low, high, DISTANCE)` urteilt wie zwei Zeiträume
  (ADR-034, Urteil ab 5 je Seite, „deutlich“ aus T3).
- Tests (`influences.test.ts`): eine Gruppe mit klarem Abstand (sechs hohe mit +0,3, sechs niedrige mit −0,3, Streuung
  0,8 auf 40 Schuss) → `verdict` „higher“; vier auf einer Seite → `test` null; alle gleich → beide Gruppen leer,
  `comparison` null; Stress mit hohem Wert und negativem Abstand → „lower“. Fixture so, dass „ohne Form“ ein anderes Urteil
  gäbe (der Ø je Schuss steigt über die Zeit, der Abstand nicht; conventions §9 „Charakterisierungstests“).

### Ausführung: „Merkst du, wann eine Serie gut ist?“ (`src/diary/analysis/execution.ts`)

Entschieden für **Teilung je Scheibe**: Je Scheibe eines Eintrags werden ihre bewerteten Serien mit Wert am Median ihrer
Bewertungen geteilt (`splitAtMedian`), und jede Serie zählt mit ihrem Ø je Schuss minus dem Ø je Schuss der bewerteten
Serien derselben Scheibe. Begründung: Innerhalb einer Scheibe fallen Tagesform und Fortschritt heraus. Eine Teilung über
alle Serien am gemeinsamen Median verglich wieder gute gegen schlechte Abende, denn wer in einer guten Phase ist,
bewertet oft alles höher. Eine Scheibe mit gleich bewerteten Serien sagt nichts und zählt nicht (genannt).

```ts
export interface RatedCard {
  entryId: string
  day: string
  cardId: string
  /** Serien der Scheibe mit Ø je Schuss, wie `FormCard.series` */
  series: { series: number; shots: number; mean: number | null }[]
  /** Bewertung je Seriennummer, 0 bis 100 */
  ratings: ReadonlyMap<number, number>
}
export interface ExecutionResult {
  /** gezählte Serien und Abende (verschiedene Tage) */
  series: number
  evenings: number
  /** Scheiben mit bewerteten Serien, die alle gleich bewertet sind */
  sameRated: number
  high: number
  low: number
  /** a die schwächer, b die besser bewerteten; Δ in Ringen je Schuss */
  comparison: PeriodComparison | null
}
export function executionCheck(cards: readonly RatedCard[]): ExecutionResult
```

- Werte: `CardValue { id: "<card>:<series>", atMs: 0, value: zentriert, n: shots }` ohne `sd` (die Projektion kennt keine
  Streuung je Serie), also Rangtest über die Serien (`compareValues(low, high, DISTANCE)`), Urteil ab 5 Serien je Seite.
- Serien ohne Wert oder ohne Bewertung fallen weg; eine Bewertung auf einer Seriennummer, die die Scheibe nicht hat,
  zählt nicht.
- Tests: zwei Scheiben auf verschiedenem Niveau, besser bewertete je +0,4 → „higher“, obwohl die schlechte Scheibe nur
  gut bewertete Serien hat (Fixture so, dass eine Teilung über alle Serien „lower“ ergäbe); gleich bewertet → `sameRated`
  1, nichts gezählt; Mutationsprobe (Zentrieren weg, der Test wird rot).

### Selbstbild ohne Urteil (`src/diary/analysis/self-image.ts`)

- **Erwartet und geschossen:** Geschossen ist, was die Seite eines Eintrags unter Feedback zeigt: genau eine Scheibe im
  Eintrag (verknüpft und dazugekommen) mit Ergebnis (`ResultCard.result`). Die Regel zieht aus `EntryScreen.tsx` als
  reine Funktion `shotResult(cards: readonly ResultCard[]): ResultValue | null` nach `src/diary/summaries.ts`, die
  Eintragsseite ruft dann sie (keine zweite Regel).

  ```ts
  export interface ExpectedRow { entryId: string; day: string; expected: number; shot: ResultValue; delta: number }
  export function expectedRows(entries: readonly { id: string; day: string; expectedScore: number | null; cards: readonly ResultCard[] }[]): {
    rows: ExpectedRow[] // neueste oben
    mean: number | null // Mittel der Abstände
    /** mit erwartetem Ergebnis, aber nicht genau einer Scheibe mit Ergebnis */
    left: number
  }
  ```

- **Vorher und nachher:** je der sieben Bereiche (`SCALE_ASPECTS.prognosis`) das Mittel der Prognose und des Feedbacks über
  die Einträge, die in diesem Bereich beides haben; `pairs` je Bereich, `n` = Einträge mit mindestens einem Paar. Lage auf
  der Skala: `stagePosition(value) = min(5, max(1, (value + 10) / 20))` (Mitte einer Stufe → ihre Zahl).

  ```ts
  export function beforeAfter(entries: readonly { scales: readonly { part: ScalePart; aspect: string; value: number }[] }[]): {
    n: number
    rows: { aspect: ScaleAspect; prognosis: number | null; feedback: number | null; pairs: number }[]
  }
  ```

- Tests: zwei Scheiben → keine Zeile, `left` 1; Mittel −5 aus −7, +2, −10; `stagePosition(10)` 1, `(90)` 5, `(0)` 1,
  `(100)` 5, `(50)` 3; Bereich ohne Paar → `pairs` 0, Mittel null; `shotResult` mit einer Scheibe ohne Ergebnis → null.

### Was die Seite liest (`src/diary/analysis/queries.ts`)

```ts
export type WellbeingAspect = "sleep" | "energy" | "stress" | "motivation"

export interface AnalysisView {
  /** Disziplinen mit Einträgen, die mit dem jüngsten Eintrag zuerst */
  families: Family[]
  family: Family | null
  /** Saisons mit Einträgen der Disziplin, neueste zuerst; `season` null heißt „Alles“ */
  seasons: Season[]
  season: Season | null
  influences: {
    /** Einträge mit Befinden im Zeitraum */
    withWellbeing: number
    rows: InfluenceRow[]
    /** mit Befinden, die nicht zählen */
    left: { noCard: number; noForm: number }
  }
  execution: ExecutionResult & { rated: number }
  expected: ReturnType<typeof expectedRows>
  beforeAfter: ReturnType<typeof beforeAfter>
}

export async function analysisView(
  db: Db,
  userId: string,
  query: { family: string | null; season: string | null },
  timeZone: string
): Promise<AnalysisView>

export interface FactorView {
  family: Family
  season: Season | null
  aspect: WellbeingAspect
  row: InfluenceRow
  left: { noCard: number; noForm: number }
}
export async function factorView(
  db: Db,
  userId: string,
  query: { aspect: WellbeingAspect; family: string | null; season: string | null },
  timeZone: string
): Promise<FactorView | null>
```

- Einträge: eigene, nicht im Papierkorb, `familyId` gesetzt; Einflüsse und Ausführung nur `kind = shooting`, Vorher und
  nachher alle Arten. Chips: die Familien dieser Einträge (`resultFamilies` für die Namen), unbekanntes `?family=` → die
  erste. `?season=2025` ist das Startjahr einer Saison (`seasonOf`, 1. September bis 31. August, aus
  `src/diary/goals/season.ts`), unbekannt → „Alles“; der Zeitraum filtert die Einträge, nie die Form.
- Scheiben eines Eintrags über `entryCards` (wie `diaryList`, mit `linkData`), davon die der gewählten Familie aus
  `resultFormCards`, dann `countedCards`. Ein Eintrag mit Befinden ohne gezählte Scheibe mit Wert → `left.noCard`, ohne
  Form → `left.noForm`. `competition`: eine gezählte Scheibe ist ein Wettkampf.
- Ausführung: `DiarySeriesExecution` der Einträge, nur für Scheiben, die zum Eintrag gehören und gezählt sind; `rated` =
  bewertete Serien insgesamt (für den Leersatz).
- Nur lesend. Tests (`analysis/queries.test.ts`) gegen die Dev-DB mit eigener Anlage (`createTestSite`, am Ende gelöscht):
  sieben Scheiben an sieben Abenden über `writeEnteredCard` mit Einzelschüssen, drei Einträge (einer am sechsten Abend mit
  Befinden → zählt mit Form aus fünf, einer am dritten → `noForm`, einer ohne Scheibe → `noCard`), eine Saison-Grenze
  (31. August / 1. September), ein Eintrag im Papierkorb zählt nicht, eine fremde Familie erscheint als zweiter Chip.

### Oberfläche

- **Reiter:** `DiaryHeader` bekommt `current: … | "analysis"`, den fünften Reiter „Auswertung“ (`/diary/analysis`) und
  `NEW_BUTTON.analysis = ["/diary/new", LIST_TEXTS.newEntry]`. Bis der Baustein `TabBar` im Basisbranch ist, wischt die
  heutige Leiste in sich (`max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`, Links
  `shrink-0 whitespace-nowrap`), damit die Seite bei 360 px nicht breiter wird. Danach Aufgabe 21.
- **`/diary/analysis`** (`AnalysisScreen`, eine Spalte `PAGE_SINGLE`, Kopf `DiaryHeader current="analysis"`):
  1. Filter (`AnalysisFilters`, Client): Chips der Disziplinen als Links wie in „Fragen“ (`?family=`, Zeitraum bleibt),
     darunter `Segmented` mit `wrap` „Alles“ · „Saison 26/27“ · „Saison 25/26“ … (`router.push`, Disziplin bleibt). Ohne
     Disziplin weder Chips noch Zeitraum. Am Desktop (ab 768 px) beide in einer Zeile.
  2. **Einflüsse** (Überschrift mit „?“ `DiaryHelp id="influences"`), ein Kasten: Satz „Wie lagst du gegenüber deiner
     Form, je nach Befinden vor dem Training? {n} Einträge mit Befinden.“, dann je Merkmal eine Zeile (`InfluenceLine`,
     ganz ein Link auf `/diary/analysis/{aspect}?family=…&season=…`): Name, Urteil als Pille (besser `success-wash`/
     `success`, schwächer `warning-wash`/`warning`, sonst `surface-2`/`muted-foreground`), der Strich
     (`InfluenceStrip`, SVG: Achse, Form-Linie gestrichelt in `quiet` bei 0, hoher Wert gefüllter Punkt `primary`,
     niedriger hohler Punkt mit Rand `primary`, Verbindung in `primary`, Beschriftung „−0,3“, „Form“, „+0,3“; Spanne
     symmetrisch `max(0,3, aufgerundet auf 0,1 über dem größten |Mittel|)`), der Satz mit Zahlen und n; am Desktop als
     Raster `9rem 1fr 15rem`. Legende „hoher Wert“, „niedriger Wert“, „deine Form“. Darunter die Grundlage (nur wenn etwas
     nicht zählt). Ohne Eintrag mit Befinden steht im Kasten nur der Leersatz.
  3. **Selbstbild** (Überschrift mit „?“ `DiaryHelp id="selfImage"`), am Telefon untereinander, ab 768 px die ersten
     beiden Karten nebeneinander (`md:grid-cols-2`), „Vorher und nachher“ darunter über die volle Breite:
     - „Merkst du, wann eine Serie gut ist?“: Pille, leise „{s} Serien an {a} Abenden“, Satz; Grundlage bei
       `sameRated`; leer der Leersatz.
     - „Erwartet und geschossen“: Tabelle Eintrag (Tag als Link in den Eintrag) · erwartet · geschossen · Abstand
       (positiv `success`, negativ `warning`, mit Vorzeichen), die ersten fünf, dann „Alle {n} Einträge zeigen“
       (klappt auf, wie die Einträge eines Ziels), darunter das Mittel; leer der Leersatz.
     - „Vorher und nachher“ (`BeforeAfter`): Legende „vorher“ (gestrichelter Ring `quiet`), „nachher“ (gefüllter Punkt
       `primary`), „Mittel aus {n} Einträgen“, Skala 1 bis 5, je Bereich eine Zeile mit Namen (`ASPECT_LABELS`) und Spur
       mit fünf Marken; ein Bereich ohne Paar zeigt nur die Spur und „–“ mit Grund „kein Eintrag mit beidem“ (conventions
       §2). Leer der Leersatz.
  - Die Abschnitte stehen immer da, auch für ein neues Konto (conventions „Konsistenz“): Inhalt oder Leersatz, nie eine
    andere Seite.
- **`/diary/analysis/[factor]`** (`FactorScreen`, `factor` ∈ `sleep|energy|stress|motivation`, sonst `notFound()`;
  ohne Disziplin oder ohne Einträge der Disziplin → zurück auf `/diary/analysis`): Rückweg „Auswertung“ (mit Disziplin und
  Zeitraum), Name als `h1`, Unterzeile „{Disziplin} · {Alles|Saison} · {n} Einträge“, Kasten mit Pille und „Abstand {±Δ}“,
  der Punktwolke (`InfluenceScatter`, SVG: x die Stufe 1–5 des Werts mit fester Verschiebung je Punkt einer Stufe
  (`((k % 5) − 2) × 6` px), y der Abstand, symmetrisch `max(0,4, aufgerundet auf 0,1)`, Linie der Form gestrichelt bei 0,
  hohe Gruppe gefüllt, niedrige hohl, ohne Gruppe in `quiet`; jeder Punkt ein `<a href="/diary/{id}">` mit
  `aria-label` und einem unsichtbaren Kreis r 12 als Ziel), Legende, Hinweis, dann die Liste der Einträge, neueste oben
  (Tag, „{Training|Wettkampf} · {Merkmal} {Stufe}“, Abstand mit Vorzeichen in `success`/`warning`, ganz ein Link), die
  ersten fünf und „Alle {n} Einträge zeigen“. Darunter die Grundlage wie auf der Übersicht.
- **Hilfe** (`DiaryHelp`, Client, wie `AdminHelp`): `HelpButton` aus `@vereinsheim/shot-ui/help/HelpButton`, das Blatt
  `HelpSheet` aus `@vereinsheim/ui/design2/help-sheet` mit `entry` aus `ANALYSIS_HELP` (Form `HelpText`). Offener Punkt 5.
- Nur Tokens, keine Palette, kein `dark:`, Zahlen über `formatValue` (shot-ui) und Tage über `dayLabel`; Server-Seiten
  reichen nur Daten an Client-Teile, Client-Komponenten importieren aus `analysis/queries.ts` nur Typen.

### Vorschau-Werkzeug

Aufruf (nur Dev-DB, E-Mails nur auf der Kommandozeile):

```
pnpm --filter spiegel diary-preview --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel> [--dry-run]
pnpm --filter spiegel diary-preview --delete --to <E-Mail in Spiegel>
```

**Lesen aus Treffsicher** wie V1 über `psql` im Dev-Container, ohne Verbindung der App zur fremden Datenbank (ADR-002):
`tools/diary-preview.ts` startet `docker compose -f <root>/docker-compose.dev.yml exec -T db psql -U postgres -d
treffsicher -At -v ON_ERROR_STOP=1 -v from=<E-Mail>` (Argumente ohne Shell) und gibt `tools/transfer/treffsicher-sessions.sql`
über stdin. Das SQL liefert eine Zeile JSON: das Konto (über `lower(trim(email)) = lower(trim(:'from'))`) mit allen
Einheiten samt Disziplin (Name, Wertung, Serien, Schuss je Serie, Probeserien), Serien (Position, Probe, Summe, Schüsse,
Bewertung), Befinden, Prognose, Feedback, Reflexion, Trefferlage, Ort, Trainingsziel. Ohne Treffer bricht das Werkzeug
mit „Konto in Treffsicher nicht gefunden“ ab. Die JSON-Datei wird nicht gespeichert. (V1 liegt unter
`apps/spiegel/scripts/transfer/`; das ist für den Autopiloten geschützt, deshalb `tools/transfer/`.)

**Schutz:** `assertDevDatabase(process.env.DATABASE_URL ?? DEV_DATABASE_URL, false)` vor jedem Schreiben, Treffsicher
nur über `docker-compose.dev.yml`. Ausgabe nur Zahlen, Bericht nach `reports/tis-2c/diary-preview.md` (gitignored).

**Zuordnung zur Scheibe** (`src/lib/transfer/treffsicher-card.ts`, Ergebnisteil, rein):

```ts
export interface TreffsicherSessionForCard {
  id: string
  dateMs: number
  type: "TRAINING" | "WETTKAMPF" | "TROCKENTRAINING" | "MENTAL"
  location: string | null
  discipline: { name: string; scoringType: "WHOLE" | "TENTH"; shotsPerSeries: number } | null
  series: { position: number; isPractice: boolean; scoreTotal: number | null; shots: string[] | null }[]
  hitLocation: { xMm: number; yMm: number } | null
}
/** die Familie zum Namen einer Treffsicher-Disziplin: Name gleich ohne Groß- und Kleinschreibung und Rand, genau eine */
export function familyForName(name: string, families: readonly { id: number; name: string }[]): number | null
/** die Disziplin der ersten Anlage in dieser Familie mit dieser Schusszahl (eingeordnet, nicht ignoriert, mit Scheibenbild); bei mehreren die vom Konto meistgenutzte, sonst null */
export function disciplineForShots(
  candidates: readonly { id: number; plannedShots: number | null; ownCards: number }[],
  shots: number
): number | null
/** die Angaben einer Scheibe aus einer Einheit, so viel Treffsicher hat; null ohne Wertungsserie mit Wert */
export function treffsicherDetails(session: TreffsicherSessionForCard): { details: DetailsInput; level: "shots" | "series" | "total"; shots: number } | null
```

- Wertungsserien (ohne Probe) mit Wert, neu nummeriert 1 … k. Haben alle Einzelschüsse: Schüsse (`ring` aus der Zahl, bei
  `TENTH` dazu `decimalTenths`, wie `matchShots` in `apps/treffsicher/src/lib/statistics/periodItems.ts`) plus
  Serien-Summen (`rings` bzw. `decimalTenths`) und Gesamtergebnis; sonst nur Serien-Summen und Gesamtergebnis (Summe
  der Serien, nur wenn jede einen Wert hat). Probeserien mit Schüssen als Probeschüsse (`probe: true`, `series` null).
  Trefferlage: `xUm = ±xMm · 1000` (RIGHT +), `yUm = ±yMm · 1000` (HIGH +), `shots` = Wertungsschüsse (wie `locationOf`
  in Treffsicher). `checkDetails` mischt Serien mit und ohne Schüsse nicht, daher diese Regel.
- Scheibe: `origin "treffsicher"`, `kind`/`kindChoice` aus `TRAINING`/`WETTKAMPF`, `startedAtMs = dateMs`, `place =
  location`, `reason "Vorschau aus Treffsicher"`, `importKey "treffsicher:preview-<Einheit>"` (passt auf `IMPORT_KEY`,
  offener Punkt 2). Geschrieben über `writeEnteredCard` (ersetzt bei gleichem Schlüssel).
- Tests: alle Schüsse → `level "shots"`, Summen gleich `checkDetails` ohne Problem (gegen die echte Prüfung mit
  `plannedShots` 40, `seriesShots` 10); eine Serie ohne Schüsse → `level "series"`; Probeserie → Probeschüsse;
  `familyForName(" luftpistole ", …)` trifft, zwei gleiche Namen → null; `disciplineForShots` mit zwei Kandidaten für 60 →
  der meistgenutzte, gleich oft → null; Trefferlage LEFT/LOW → negative Werte.

**Zuordnung zum Eintrag** (`src/diary/transfer/treffsicher-entry.ts`, Tagebuch, rein):

```ts
type PrognosisAspect = (typeof SCALE_ASPECTS.prognosis)[number]
export interface TreffsicherSessionForEntry { id: string; dateMs: number
  type: "TRAINING" | "WETTKAMPF" | "TROCKENTRAINING" | "MENTAL"
  trainingGoal: string | null; isFavourite: boolean; location: string | null
  wellbeing: Record<"sleep" | "energy" | "stress" | "motivation", number> | null
  prognosis: (Record<PrognosisAspect, number> & { expectedScore: number | null; expectedCleanShots: number | null; performanceGoal: string | null }) | null
  feedback: (Record<PrognosisAspect, number> & { explanation: string | null; goalAchieved: boolean | null; goalAchievedNote: string | null; progress: string | null; fiveBestShots: string | null; wentWell: string | null; insights: string | null }) | null
  reflection: { observations: string | null; insight: string | null; learningQuestion: string | null; routineDeviation: string | null } | null
  series: { position: number; isPractice: boolean; executionQuality: number | null }[] }
export interface ImportedEntry {
  importKey: string; day: string; kind: "shooting" | "dry" | "mental"; familyId: number | null
  intention: string | null; outcome: "yes" | "no" | null; learned: string | null; question: string | null
  note: string | null; expectedScore: number | null
  scales: { part: ScalePart; aspect: ScaleAspect; value: number }[]
}
/** `withCard`: die Einheit hat eine Scheibe in Spiegel (vorhanden oder angelegt); sonst steht der Ort in der Notiz */
export function entryFromSession(
  session: TreffsicherSessionForEntry,
  context: { familyId: number | null; withCard: boolean; timeZone: string }
): ImportedEntry
/** Ausführung je Wertungsserie auf die Serien einer Scheibe: Position k → Serie k, Wert `valueOfStage(1…5)`; null bei anderer Serienzahl */
export function executionsOnCard(session: TreffsicherSessionForEntry, cardSeries: readonly { series: number }[]): { series: number; value: number }[] | null
```

- `ImportedEntry`: `day` (Abend der Einheit, `eveningDay`), `kind` (`shooting`, `dry`, `mental`), `familyId`,
  `intention` (Trainingsziel, sonst Leistungsziel der Prognose), `outcome` (Ziel erreicht → `yes`/`no`, nur mit
  Vorhaben), `learned` (Erkenntnis), `question` (Lernfrage), `note` (Beobachtungen, darunter mit Überschrift je Feld ohne
  eigenes Feld: „Abweichung vom Ablauf“, „Abweichung von der Prognose“, „Zum Ziel“, „Fortschritt“, „Fünf beste Schüsse“,
  „Was gut lief“, „Erkenntnisse“, „Erwartete saubere Schüsse“, „Ort“ nur ohne Scheibe, „Favorit“), `expectedScore`,
  `scales` (genau wie gespeichert, 0 bis 100), `importKey "preview:<Einheit>"`. „Ablauf eingehalten“ fällt weg (ADR-033,
  2a). Stufe 3 kann die Felder übernehmen und nur den Schlüssel ändern.
- Ausführung (Treffsicher 1 bis 5): `valueOfStage` (10, 30, 50, 70, 90). Probeserien und Serien ohne Bewertung fallen
  weg; stimmt die Zahl der Wertungsserien nicht mit den Serien der Scheibe überein → null (gezählt als „andere
  Serienzahl“).
- Tests: Felder je Quelle, Überschriften in der Notiz in fester Folge, `outcome` nur mit Vorhaben, Abend vor 4 Uhr → Vortag,
  `executionsOnCard` mit Probeserie (fällt weg), 4 gegen 4 → vier Werte, 4 gegen 6 → null.

**Schreiben ins Tagebuch** (`src/diary/transfer/write.ts`, Tagebuch): `upsertImportedEntry(tx, userId, entry)` (über
`importKey`: anlegen oder Felder setzen, Werte ersetzen; die Kennung bleibt), `setImportedLinks(tx, entryId, cardIds)`
(Zeilen `linked`, `DiaryEntryCard` per `cardId`), `replaceExecutions(tx, entryId, rows)`, `deletePreviewDiary(tx,
userId)` (alle `DiaryEntry`, `DiaryGoal`, `DiaryRoutine` mit `importKey LIKE 'preview:%'` des Kontos; die Kaskade nimmt
Werte, Zeilen und Ausführung mit). Tests gegen die Dev-DB mit eigenem Konto: zweimal derselbe Eintrag → eine Zeile,
gleiche Kennung, Werte ersetzt; Löschen nimmt nur `preview:`-Zeilen dieses Kontos.

**Ablauf** (`src/parts/transfer/diary-preview.ts`, Nahtstelle): `treffsicherExport` (zod-Schema der JSON-Zeile),
`runPreview(db, { export, toUserId, timeZone, dryRun }) → PreviewReport` und `deletePreview(db, toUserId) →
PreviewReport`.

1. Familien (`db.family`), Kandidaten je Familie (Disziplinen der ersten Anlage `requestSiteId`, `confirmedAt` gesetzt,
   nicht ignoriert, mit `targetId`, `plannedShotsOf`, eigene Scheiben je Disziplin), eigene sichtbare Scheiben je Abend
   und Familie über `resultCards` **ohne** Schlüssel `treffsicher:preview-…`.
2. Je Einheit: Familie über den Namen (sonst gezählt „Disziplin nicht zugeordnet“ mit dem Namen der Disziplin, kein
   Personenbezug). Hat der Abend in dieser Familie eine Scheibe (auch „nur Probe“, jede Herkunft außer der Vorschau),
   entsteht keine. Sonst mit Ergebnis eine Scheibe aus `treffsicherDetails` (ohne passende Disziplin gezählt, ohne
   Scheibe). Eine Vorschau-Scheibe, deren Einheit keine mehr braucht (inzwischen eine echte Scheibe am Abend), wird über
   `purgeCards(tx, ids, { lock: true })` entfernt.
3. Eintrag über `upsertImportedEntry`; eine angelegte Scheibe bekommt eine Zeile `linked` zu ihrem Eintrag (bei zwei
   Einheiten an einem Abend kommt sie sonst nur als Angebot).
4. Ausführung: die Scheibe des Eintrags ist die angelegte, sonst die eine gezählte des Abends (`countedCards`: eine
   Wertung, oder an einem Abend ohne Wertung genau eine „nur Probe“), sonst keine (gezählt „mehrere Scheiben“ bzw. „zwei
   Einheiten am Abend“: dann bekommen beide Einträge keine Scheibe von selbst). Serien aus `resultCardSeries`;
   `executionsOnCard` null → „andere Serienzahl“.
5. `--dry-run` rechnet alles und schreibt nichts.
6. Bericht (`PreviewReport`, nur Zahlen): Einheiten, Einträge angelegt/geändert, Scheiben angelegt/ersetzt/unverändert/
   entfernt je Detailtiefe, ohne Scheibe (Abend hat eine, kein Ergebnis, keine Disziplin), Ausführung gelegt/ausgelassen
   je Grund, Probeserien ausgelassen, nicht zugeordnete Disziplinen nach Name, Tagebuch des Kontos an oder aus.

`deletePreview`: `purgeCards` für alle Scheiben des Kontos mit `importKey LIKE 'treffsicher:preview-%'`, dann
`deletePreviewDiary`. Ziele und Abläufe schreibt `runPreview` nicht (offener Punkt 3), `--delete` nimmt sie mit.

Tests (`diary-preview.test.ts`) gegen die Dev-DB mit eigener Anlage und erfundenem Export (drei Einheiten: eine an einem
Abend mit Scheibe, eine ohne, eine mit Ausführung und einer Probeserie): erster Lauf legt eine Scheibe und drei Einträge
an, Zeile `linked`, Ausführung auf vier Serien; zweiter Lauf ändert nichts an der Zahl der Zeilen (`unchanged`);
`dryRun` schreibt nichts; `deletePreview` lässt Einträge ohne `preview:` stehen.

## Texte (Textbuch Spiegel, „Tagebuch (2c)“; erst hier freigeben, dann in den Code)

Schreibregeln conventions §10, keine Semikolons, keine Pronomen für Personen. `{…}` setzt die App ein, Zahlen mit Komma.
Alle in `src/diary/analysis/texts.ts` (`ANALYSIS_TEXTS`, `ANALYSIS_HELP`).

**Reiter und Filter:** Reiter „Auswertung“; Knopf oben „Neuer Eintrag“; Zeitraum „Alles“, „Saison {26/27}“.

**Einflüsse:** Überschrift „Einflüsse“; Einleitung „Wie lagst du gegenüber deiner Form, je nach Befinden vor dem
Training? {n} Einträge mit Befinden.“ („1 Eintrag“); Namen „Schlaf“, „Energie“, „Stress“, „Motivation“; hohe und
niedrige Gruppe „Guter Schlaf“ / „Schlechter“, „Viel Energie“ / „Wenig“, „Viel Stress“ / „Wenig“, „Hohe Motivation“ /
„Niedrige“; Urteil „{Hohe Gruppe}: besser“, „…: deutlich besser“, „…: schwächer“, „…: deutlich schwächer“ (Worte aus
`verdictText`), „Kein klarer Unterschied“, „Noch kein Urteil“; Satz mit Urteil oder Unterschied „{Hohe Gruppe}: {x} über
deiner Form ({n}). {Niedrige}: {y} unter ({m}).“ („über“/„unter“ je Vorzeichen, unter 0,005 „gleichauf mit deiner Form“);
noch kein Urteil „Unter der Mitte liegen erst {m} Einträge. Für ein Urteil braucht es 5.“ bzw. „Über der Mitte …“, beide
zu wenig „Über der Mitte liegen {n} Einträge, darunter {m}. Für ein Urteil braucht es auf jeder Seite 5.“; alle gleich
„Alle Einträge haben hier denselben Wert. So gibt es nichts zu vergleichen.“; Legende „hoher Wert“, „niedriger Wert“,
„deine Form“; Strich „Form“; Grundlage „{a} Einträge ohne Scheibe zählen nicht mit.“, „{b} Einträge ohne fünf Scheiben
davor zählen nicht mit.“ (beide: „{a} Einträge ohne Scheibe und {b} ohne fünf Scheiben davor zählen nicht mit.“); leer
„Noch kein Eintrag mit Befinden. Trag es vor dem Training in einem Eintrag unter „Vorher“ ein. Ab 10 Einträgen zeigt
Spiegel hier, ob es mit deinem Ergebnis zusammenhängt.“

**Seite eines Merkmals:** Rückweg „Auswertung“; Unterzeile „{Disziplin} · {Alles|Saison 26/27} · {n} Einträge“; „Abstand
{±Δ}“; Legende „über der Mitte“, „unter der Mitte“, „deine Form“; Hinweis „Jeder Punkt ist ein Eintrag. Oben lagst du über
deiner Form, unten darunter. Ein Tipp öffnet den Eintrag.“; Zeile „{Training|Wettkampf} · {Merkmal} {Stufe}“; „Alle {n}
Einträge zeigen“; Punkt für Screenreader „{Tag}, {Merkmal} {Stufe}, {±x} zur Form“.

**Selbstbild:** Überschrift „Selbstbild“.

- „Merkst du, wann eine Serie gut ist?“; Pillen „Ja, deutlich“, „Ja“, „Eher umgekehrt“, „Kein klarer Unterschied“,
  „Noch kein Urteil“; leise „{s} Serien an {a} Abenden“; Satz „Serien, die du besser bewertet hast, lagen {x} Ringe je
  Schuss über den schwächer bewerteten derselben Scheibe.“ („unter“ je Vorzeichen); noch kein Urteil „Erst {h} besser
  und {l} schwächer bewertete Serien. Für ein Urteil braucht es je 5.“; Grundlage „{k} Scheiben mit gleich bewerteten
  Serien zählen nicht mit.“; leer „Noch keine bewertete Serie. Bewerte Serien im Eintrag unter „Nachher“.“
- „Erwartet und geschossen“; Spalten „Eintrag“, „erwartet“, „geschossen“, „Abstand“; Mittel „Im Mittel {x} Ringe unter
  deiner Erwartung.“ / „über“ / „Im Mittel genau wie erwartet.“, dazu „{n} Einträge. Für mehr als die Zahl reicht das
  nicht.“; Grundlage „{k} Einträge mit erwartetem Ergebnis haben nicht genau eine Scheibe mit Ergebnis und fehlen hier.“;
  „Alle {n} Einträge zeigen“; leer „Noch kein Eintrag mit erwartetem Ergebnis. Trag es im Eintrag bei der Prognose ein.“
- „Vorher und nachher“; Legende „vorher“, „nachher“, „Mittel aus {n} Einträgen“; Grund „kein Eintrag mit beidem“; leer
  „Noch kein Eintrag mit Prognose und Feedback. Trag die Prognose vor dem Training ein und das Feedback danach.“

**Hilfe** (`ANALYSIS_HELP`):

- `influences`: Titel „Einflüsse“; Was „Hier siehst du, ob dein Ergebnis mit deinem Befinden vor dem Training
  zusammenhängt. Jeder Eintrag zählt mit dem Abstand seines Ø je Schuss zu deiner Form.“; So liest du es „Deine Form ist
  der Schnitt deiner fünf Scheiben derselben Disziplin vor diesem Abend. Das ist dieselbe Linie wie der Schnitt der
  letzten fünf im Fortschritt. Je Merkmal teilt Spiegel deine Einträge am mittleren Wert. Der gefüllte Punkt zeigt die
  Einträge mit hohem Wert, der hohle die mit niedrigem.“; Vorsicht „Ein Zusammenhang ist noch kein Grund. Wer müde ist,
  trainiert vielleicht auch anders.“; Mindestzahl „Ein Urteil gibt es ab 5 Einträgen über und 5 unter der Mitte. Ein
  Eintrag zählt erst, wenn es fünf Scheiben davor gibt.“
- `selfImage`: Titel „Selbstbild“; Was „Hier siehst du, wie gut du dich selbst einschätzt: ob du gute Serien erkennst,
  wie nah dein erwartetes Ergebnis lag und wie du die Bereiche vorher und nachher gesehen hast.“; So liest du es „Bei den
  Serien vergleicht Spiegel nur Serien derselben Scheibe. So zählt die Tagesform nicht mit.“; Mindestzahl „Ein Urteil
  gibt es ab 5 Serien auf jeder Seite. Erwartet und geschossen sowie vorher und nachher zeigen nur Zahlen.“

Test `texts.test.ts`: alle Texte (Funktionen mit Beispielwerten 0, 1, 4, 27, positive und negative Abstände) gegen
`OLD_WORDS` aus `@/lib/admin/consequences` und `forbiddenIn` aus `@vereinsheim/lib/wording`; dazu der Wortlaut der
Urteile („Viel Energie: besser“, „Guter Schlaf: deutlich besser“, „Viel Stress: schwächer“). Der Test „kein ‚Faden‘“ in
`consequences.test.ts` erfasst die neuen Dateien von selbst.

## Dateien

Neu:

- `apps/spiegel/src/diary/analysis/`: `split.ts`, `form.ts`, `influences.ts`, `execution.ts`, `self-image.ts`,
  `queries.ts`, `texts.ts`; Tests daneben (`*.test.ts`)
- `apps/spiegel/src/diary/components/`: `AnalysisScreen.tsx`, `AnalysisFilters.tsx`, `InfluenceLine.tsx`,
  `InfluenceStrip.tsx`, `InfluenceScatter.tsx`, `FactorScreen.tsx`, `SelfImage.tsx` (Ausführung, Erwartet und geschossen,
  Vorher und nachher), `DiaryHelp.tsx`, `analysis-components.test.tsx`
- `apps/spiegel/src/app/(app)/diary/analysis/page.tsx`, `analysis/[factor]/page.tsx`
- `apps/spiegel/src/lib/transfer/treffsicher-card.ts` (+ Test)
- `apps/spiegel/src/diary/transfer/treffsicher-entry.ts`, `write.ts` (+ Tests)
- `apps/spiegel/src/parts/transfer/diary-preview.ts` (+ Test)
- `apps/spiegel/tools/diary-preview.ts`, `apps/spiegel/tools/transfer/treffsicher-sessions.sql`

Geändert:

- `apps/spiegel/src/lib/results-read.ts` (+ Test): `resultFormCards`
- `apps/spiegel/src/diary/summaries.ts` (+ Test): `shotResult`; `components/EntryScreen.tsx` nutzt sie
- `apps/spiegel/src/diary/components/DiaryList.tsx` (`DiaryHeader`), `components/components.test.tsx`
- `apps/spiegel/package.json` (Script `diary-preview`)
- `apps/spiegel/tools/pruefen-diary.ts`
- `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-diary.md`, `vault/spiegel/spiegel-account-transfer.md`,
  `vault/decisions/adr-033.md` (Nachtrag, ⛔), `vault/index.md` falls nötig

## Required Docs

- `vault/spiegel/spiegel-diary.md` (Zonen, Stellen, Seiten, Stufen)
- `vault/decisions/adr-033.md` (Tagebuch und Bezüge, Nachträge 2a und 2b), `vault/decisions/adr-034.md` (Werte über die
  Schüsse, Urteile über Schüsse und Abende, ab 5 je Seite)
- `vault/conventions.md` (§2 Hilfe, „–“ mit Grund, §3 Kontrast, §4 Tokens, §9 Charakterisierung, Mutation, Daten vor der
  Sichtprüfung, Feld fester Breite am Telefon, Toast über klebender Leiste, §10 Schreibregeln)
- `apps/spiegel/CLAUDE.md` (Tagebuch, Projektion, Werkzeuge), `packages/shot-core/CLAUDE.md` (Pooling, Projektion)
- `vault/spiegel/spiegel-account-transfer.md` (V1, Zuordnung je Konto)
- `plans/2026-10-26-treffsicher-in-spiegel.md` („Designkonzept 2c, Runde 2“, Stufe 3, Regeln für Kindsessions)
- Treffsichers Vorbild: `apps/treffsicher/src/lib/statistics/influences.ts`, `selfImage.ts`, `periodItems.ts`

## Aufgaben

Jede Aufgabe ein Commit, Gate vor jedem Commit (`pnpm check` im Worktree, `&&` vor `git commit`). Die mit ⛔ halten an und
gehen erst an die Koordination.

**Teil A · Rechnung**

1. Plan als erster Commit (`docs(plans): 2c diary analysis`).
2. `resultFormCards` in `results-read.ts` mit Test (siehe oben).
3. `shotResult` in `summaries.ts` mit Test, `EntryScreen` ruft sie (Markup-Test der Eintragsseite bleibt grün).
4. `analysis/split.ts` mit Tests und Mutationsprobe.
5. `analysis/form.ts` mit Tests, Gegenprobe gegen `deltasBefore` und Mutationsprobe.
6. `analysis/influences.ts` mit Tests.
7. `analysis/execution.ts` mit Tests und Mutationsprobe.
8. `analysis/self-image.ts` mit Tests.
9. `analysis/texts.ts` (Texte und Hilfe wie oben) mit `texts.test.ts`.

**Teil B · Seiten**

10. `analysis/queries.ts` (`analysisView`, `factorView`) mit Tests gegen die Dev-DB.
11. `DiaryHeader` mit fünftem Reiter, `NEW_BUTTON.analysis`, Leiste wischt in sich; Markup-Test (fünf Reiter,
    `aria-current` auf „Auswertung“). In `tools/pruefen-diary.ts` die Prüfung der Reiter (heute „vier Reiter in einer
    Zeile, rechts im Bild“) auf „fünf Reiter in einer Zeile, Seite nicht breiter“ (`rows === 1`, `inner === visual`) und
    `ENTRY_PATH` um `goals|routines|analysis` erweitern.
12. `AnalysisScreen`, `AnalysisFilters`, `InfluenceLine`, `InfluenceStrip`, `SelfImage`, `DiaryHelp`,
    `/diary/analysis`; Markup-Tests in `analysis-components.test.tsx`: feste Folge der Abschnitte mit und ohne Daten
    (Leerzustand eines neuen Kontos zeigt Einflüsse und alle drei Teile des Selbstbilds mit Leersätzen), Pille je
    Urteil, Strich ohne Punkt bei leerer Gruppe, Grundlage nur wenn etwas nicht zählt, Zeile ist Link mit Disziplin und
    Zeitraum, „–“ mit Grund bei Bereich ohne Paar, Tabelle mit Vorzeichen.
13. `InfluenceScatter`, `FactorScreen`, `/diary/analysis/[factor]`; Markup-Tests (Punkte als Links, Seiten in Farbe und
    Form, Liste neueste oben, „Alle n Einträge zeigen“ erst ab sechs).

**Teil C · Vorschau-Werkzeug**

14. `src/lib/transfer/treffsicher-card.ts` mit Tests.
15. `src/diary/transfer/treffsicher-entry.ts` und `write.ts` mit Tests.
16. `src/parts/transfer/diary-preview.ts` mit Tests gegen die Dev-DB.
17. `tools/transfer/treffsicher-sessions.sql`, `tools/diary-preview.ts` (Argumente `--from`, `--to`, `--delete`,
    `--dry-run`; ohne `--to` oder mit `--from` und `--delete` zugleich: Aufruf erklären und Ende mit Code 2), Script in
    `package.json`. Ein Probelauf `--dry-run` mit einem erfundenen Konto ohne Einheiten in Treffsicher endet mit „Konto in
    Treffsicher nicht gefunden“ (die echten E-Mails kommen erst in Aufgabe 22).

**Teil D · Prüfung, Doku, Übergabe**

18. Skriptprüfung: Abschnitt „Auswertung“ in `tools/pruefen-diary.ts`, aufgerufen aus `run` nach `routines` (siehe
    „Tests und Verifikation“). Die Aufräumlogik bleibt (die Auswertung schreibt nichts); der Kopfkommentar nennt den
    Abschnitt.
19. Vault und Doku: `spiegel-diary.md` (Abschnitt „Auswertung“: Reiter, Form, Abend-Regel, Einflüsse, Selbstbild,
    Vorschau-Werkzeug; Reiter „Einträge · Fragen · Ziele · Abläufe · Auswertung“; `keywords` um auswertung, einflüsse,
    selbstbild, form, abstand zur form, merkst du, erwartet und geschossen, vorher und nachher, vorschau, diary-preview;
    „Was folgt“ ohne 2c), `spiegel-account-transfer.md` (die Zuordnungsfunktionen für Stufe 3, der Schlüssel
    `treffsicher:preview-`), `apps/spiegel/CLAUDE.md` (Tagebuch: Auswertung, Abend-Regel, `resultFormCards`; Befehl
    `diary-preview` in der Tabelle); `vault-lint` grün, kein Prettier auf `vault/`.
20. ⛔ Nachtrag zu ADR-033 (Text unten) als Diff an die Koordination, nach Freigabe committen.
21. ⛔ Sobald die Koordination meldet, dass `@vereinsheim/ui/design2/tab-bar` im Basisbranch ist (nach dem Rebase auf
    `main`): Branch auf den Basisbranch rebasen, `DiaryHeader` auf `TabBar` umstellen, mit der API aus dem Plan von R
    (`plans/2026-10-29-tis-r-tab-bar.md`): `<div data-diary-switch><TabBar label={LIST_TEXTS.title} items={TABS}
    current={current} renderLink={(item, props) => <Link href={item.href} {...props} />} /></div>`, `TABS` mit `key`,
    `label`, `href` der fünf Reiter. Die eigene Leiste aus Aufgabe 11 fällt weg; damit verschwindet auch ihr
    `aria-[current=page]:bg-card`, das die neue Regel in `scripts/consistency-check.sh` (§2, Teil R) sonst als
    „Reiterleiste von Hand“ meldet: Diese Aufgabe muss vor jedem Release des Basisbranchs erledigt sein. Markup-Test
    anpassen (`data-tab-bar`, fünf Links, `aria-current="page"` am gewählten), Skriptprüfung zusätzlich „der gewählte
    Reiter ist im Bild“ auf `/diary/analysis` bei 360 px. Kommt der Baustein nicht vor der Übergabe, meldet die
    Kindsession das als offen.
22. ⛔ Datenprüfung mit den Daten des Users (Teil von `/validate`), wenn die Koordination die beiden E-Mails gibt:
    1. `pnpm --filter spiegel diary-preview --from <E-Mail> --to <E-Mail> --dry-run`, Zahlen gegen den Kontext dieses
       Plans halten (Abweichungen erklären), dann ohne `--dry-run`, dann ein zweiter Lauf (nichts darf sich verdoppeln:
       Zeilen vor und nach zählen).
    2. Im Browser (der User meldet sich selbst an, Auto-Memory) `/diary/analysis` für Luftpistole, „Alles“ und die
       Saisons, und die Seite jedes Merkmals ansehen, Telefon 390 und 360 px und Desktop, hell und dunkel.
    3. Bericht `reports/tis-2c/data-check.md`, nur Zahlen: Einträge mit Befinden, davon gezählt, ohne Scheibe, ohne Form;
       je Merkmal n hoch/niedrig, Mittel, Urteil; Ausführung (Serien, Abende, gleich bewertet, Urteil); Erwartet
       (Zeilen, ausgelassen); Vorher und nachher (n). **Gegenprobe gegen Treffsicher:** dieselbe Rechnung
       (`influenceRows`) einmal mit dem Ø je Schuss der Einheit aus Treffsicher ohne Form (so rechnet Treffsicher) und
       einmal wie Spiegel, je Merkmal nebeneinander; Unterschiede durch das Maß erklären (Form gegen Ø, Abend-Regel,
       Scheiben vom Ausdruck statt eingetragener Summen). Dazu die Ausführung wie Treffsicher (Mittel der bewerteten Serien
       je Einheit als fünftes Merkmal) gegen „Serie gegen Serie“. Offene Fragen für Stufe 3.
    4. Die Vorschau-Daten bleiben stehen; im Bericht der Befehl zum Löschen.
23. `/validate` (Bericht `reports/2026-10-29-tis-2c-validate.md`, mit dem Datenbericht), Sichtprüfung mit frischem Blick,
    `/review`, Lessons, Rebase auf den Basisbranch, Gate im Worktree, Meldung an die Koordination (Branch, Commits,
    Bericht, nicht belegt, keine neue Brücke nötig).

### Nachtrag zu ADR-033 (Entwurf, geht in Aufgabe 20 als Diff an die Koordination)

> ## Nachtrag (29. Oktober 2026): Auswertung (2c)
>
> Entschieden mit dem User am 29. Oktober 2026 nach dem Designkonzept 2c, Runde 2, gebaut in 2c ([[spiegel-diary]]).
> Grundlage sind die Zählungen in der Prod-Kopie: 36 Einheiten mit Befinden und Ergebnis in 4 Konten, 180 bewertete
> Serien an 48 Einheiten, 10 Einheiten mit Prognose und Feedback.
>
> - **Ein fünfter Reiter „Auswertung“** im Tagebuch, je Disziplin, Zeitraum „Alles“ oder eine Saison. Spiegels
>   Fortschritt bleibt, wie er ist. Keine Zeile auf Start, keine Stelle im Ergebnisteil.
> - **Einflüsse gegen die Form:** Je Eintrag zählt der Abstand seines Ø je Schuss zum Schnitt der fünf Scheiben derselben
>   Disziplin vor seinem Abend (dieselbe Rechnung wie der Schnitt der letzten fünf). So darf der Zeitraum lang sein, ohne
>   dass der Fortschritt über Monate das Urteil macht. Nur Schlaf, Energie, Stress und Motivation, nur der Ø je Schuss.
>   Gruppen über und unter dem mittleren Wert wie in Treffsicher, Urteil wie zwei Zeiträume ([[adr-034]], ab 5 je Seite).
>   Einträge ohne Scheibe oder ohne fünf Scheiben davor zählen nicht und werden genannt.
> - **„Nur Probe“ zählt an einem Abend ohne Wertung:** Ausdrucke ganzer Trainings im Probe-Modus zählen in Form, Wert
>   und Ausführung, Probe-Blöcke vor einer Wertung nicht.
> - **Selbstbild:** „Merkst du, wann eine Serie gut ist?“ vergleicht besser und schwächer bewertete Serien derselben
>   Scheibe, mit Urteil. „Erwartet und geschossen“ und „Vorher und nachher“ zeigen nur Zahlen. Die Ausführung ist kein
>   Einfluss mehr wie in Treffsicher, denn die Bewertung kommt nach der Serie.
> - **Vorschau mit den Daten des Users:** ein Werkzeug nur für die Dev-DB übernimmt ein Konto aus Treffsicher mit
>   Schlüsseln `preview:` (Tagebuch) und `treffsicher:preview-` (Scheiben); es ist eine Probe für Stufe 3, die dieselben
>   Zuordnungen nimmt.
> - Damit gilt in „Was aus Treffsicher umzieht“ die Zeile „Statistik-Seite“ als: Spiegels Fortschritt und die Auswertung
>   im Tagebuch; „Ausführung je Serie“ als: trägt im Selbstbild die Frage „Merkst du, wann eine Serie gut ist?“.

Entscheidet die Koordination offenen Punkt 1 anders, passt die Kindsession die dritte Zeile vor dem Diff an.

## Tests und Verifikation

- **Gate:** `pnpm check` im Worktree (der Stop-Hook prüft den Haupt-Checkout, Auto-Memory). `boundary.test.ts` grün ohne
  neue Ausnahme.
- **Unit:** Teilung am Median, Form (Gegenprobe gegen `deltasBefore`, Mutation), Einflüsse (Charakterisierung gegen „ohne
  Form“), Ausführung (Mutation), Selbstbild, Texte (`OLD_WORDS`, Semikolon, Wortlaut der Urteile), Zuordnung Scheibe und
  Eintrag.
- **Dev-Datenbank:** `resultFormCards`, `analysisView`/`factorView`, Schreiben der Vorschau (zweimal, `dryRun`, Löschen),
  nur mit eigener Anlage und eigenem Konto.
- **Markup:** `analysis-components.test.tsx` mit `renderToStaticMarkup`.
- **Skriptprüfung** (`pnpm --filter spiegel pruefen --start --nur Tagebuch`, mit `seed:own --demo` und danach `seed:own
  --email <eigene>` in einem Befehl, Auto-Memory): Reiter „Auswertung“ ist erreichbar und gewählt; vor dem ersten Eintrag
  mit Befinden zeigt die Seite „Einflüsse“ und „Selbstbild“ mit allen drei Leersätzen; nach dem Eintrag mit Befinden aus
  `run` steht „Energie“ mit „Noch kein Urteil“ und der Grundlage oder dem Satz, wie viele fehlen; ein Tipp auf „Energie“
  öffnet `/diary/analysis/energy` mit Rückweg, Rückweg führt zurück mit derselben Disziplin; „?“ an Einflüsse öffnet das
  Blatt mit „Deine Form ist der Schnitt“ und schließt; kein seitliches Scrollen bei 390 und 360 px auf `/diary/analysis`
  und `/diary/analysis/energy`; keine Skriptfehler. Am Ende wie bisher alles des Demo-Kontos gelöscht, Tagebuch aus.
- **Sichtprüfung** mit den Vorschau-Daten (Aufgabe 22) und dem Demo-Konto, gegen das Konzept, Telefon und Desktop, hell
  und dunkel. Was die Daten nicht hergeben (etwa „Eher umgekehrt“, ein Zehntel-Konto mit Scheiben aus Treffsicher), steht
  im Bericht als „nicht belegt“ mit dem Test, der den Pfad abdeckt.
- Keine neue Brücke nötig (kein Vertrag berührt), keine Migration.

## Offene Punkte für den Koordinator

**Entschieden am 29. Oktober 2026:** Alle Empfehlungen unten gelten. Der User hat die Abend-Regel für „nur Probe“
(Punkt 1) und das Aussehen der Reiter in der Farbe der App (Teil R) bestätigt. Die übrigen Punkte hat der Koordinator
entschieden: Schlüssel `treffsicher:preview-<Einheit>`, keine Ziele und Abläufe im Werkzeug, die 94 Vorschau-Einträge
werden ersetzt, Hilfe im Tagebuch samt Satz in conventions §2, Ausführung je Scheibe, „Erwartet und geschossen“ mit der
Regel der Eintragsseite. Abweichungen davon meldet die Kindsession und wartet.

1. **„Nur Probe“ in der Auswertung** (Abweichung von Spiegels Vorgabe): Der Fortschritt lässt Scheiben „nur Probe“
   weg (`includeProbeOnly: false`). Beim größten Konto sind 46 der 49 Scheiben vom Ausdruck „nur Probe“ (ganze Trainings
   im Probe-Modus gedruckt); ohne sie fielen 8 der 26 Einträge mit Befinden und 10 der 32 mit Ausführung weg. Empfehlung:
   die Abend-Regel (eine Scheibe „nur Probe“ zählt nur an einem Abend ohne Wertung derselben Familie), damit Probe-Blöcke
   vor einer Wertung draußen bleiben. Alternative: wie der Abstand der Liste alle „nur Probe“ mitzählen
   (`includeProbeOnly: true`), oder keine (wie der Fortschritt). Die richtige Lösung für solche Ausdrucke wäre „Als
   Wertung zählen“ (SF-05, für später festgehalten).
2. **Schlüssel der Vorschau-Scheiben:** `IMPORT_KEY` erlaubt nur `treffsicher:<id>`; `preview:` scheitert in
   `writeEnteredCard`. Empfehlung: `treffsicher:preview-<Einheit>` (keine Änderung im Ergebnisteil). Folge: Stufe 3 muss
   die Vorschau vorher löschen (`--delete`) oder `treffsicher:preview-` beim Zählen auslassen. Alternative: `IMPORT_KEY`
   um `preview:` erweitern (Änderung am Schreibweg des Ergebnisteils, nur für die Dev-DB nützlich).
3. **Ziele und Abläufe der Vorschau:** Die 10 Ziele und 2 Abläufe mit `preview:` sind erfundene Prüffälle aus 2b, nicht
   aus Treffsicher. Das Konto hat in Treffsicher 3 Ziele und 2 Abläufe. Empfehlung: Das Werkzeug schreibt sie nicht (ihre
   Zuordnung ist Sache von Stufe 3), `--delete` löscht alle `preview:`-Zeilen. Alternative: Ziele und Abläufe nach den
   Regeln aus dem Nachtrag 2b mit übernehmen und die erfundenen löschen.
4. **Vorhandene 94 Vorschau-Einträge:** Das Werkzeug ersetzt sie über denselben Schlüssel `preview:<Einheit>` (die
   Kennungen bleiben) mit der Zuordnung dieses Plans. Dabei gehen ein nach dem Anlegen geänderter Eintrag und die
   4 Ausführungen an einem Eintrag verloren (Testeingaben?). Die Zuordnung der Texte (Notiz mit Überschriften) ist ein
   Vorschlag für Stufe 3, der heutige ad-hoc-Stand ist nicht im Repo.
5. **Hilfe im Tagebuch statt in `shot-help`:** conventions §2 nennt für Spiegel `@vereinsheim/shot-help`; dessen Themen
   hängen an Kennzahlen und Katalog. Empfehlung: Texte im Tagebuch (`ANALYSIS_HELP`), angezeigt wie im Admin mit
   `HelpButton` und `HelpSheet`; conventions §2 bekommt den Satz dazu. Alternative: zwei Themen in `shot-help` mit neuem
   Thema „diary“ und Erzeugung im Leitfaden.
6. **Ausführung je Scheibe statt je Abend und anderer Satz:** Das Konzept sagt „gegen die übrigen Serien desselben
   Abends“. Der Plan teilt je Scheibe am Median der Bewertungen und schreibt „über den schwächer bewerteten derselben
   Scheibe“, weil eine Serie nur gegen bewertete Serien gemessen werden kann und sich Ausführung immer auf eine Scheibe
   bezieht. Urteil als Rangtest über Serien (keine Streuung je Serie in der Projektion).
7. **Zwei Einheiten an einem Abend:** 5 Abende (10 Einheiten), alle mit Spiegel-Scheibe. Die Scheiben bleiben nur
   angeboten, keine Ausführung wird gelegt (keine dieser Einheiten hat Befinden, Ausführung oder Erwartung). Stufe 3
   braucht dafür eine Regel (Uhrzeit, Serienzahl), das Werkzeug rät nicht.
8. **Disziplin der neuen Scheiben:** Name der Treffsicher-Disziplin = Name der Familie (hier „Luftpistole“); Disziplin der
   ersten Anlage mit derselben Schusszahl, bei mehreren die vom Konto meistgenutzte (für 60 Schuss „LP 60 alt“ gegen
   „LP 60“). Die 24 neuen Scheiben brauchen nur 40 und 20 Schuss (eindeutig). Ohne passende Disziplin keine Scheibe, im
   Bericht gezählt.
9. **„Erwartet und geschossen“ mit der Regel der Eintragsseite:** genau eine Scheibe im Eintrag. An Abenden der Brücke
   mit Probe-Block und Wertung sind es zwei, dann fehlt der Eintrag (im Bericht gezählt). Empfehlung: jetzt so (eine
   Regel an beiden Stellen); später beide auf die gezählten Scheiben (Abend-Regel) umstellen.
10. **Form als feste Zahl:** Der Test behandelt die Form als bekannt; sie ist selbst ein Schnitt aus fünf Scheiben und
    wackelt. Das macht Urteile etwas zu sicher. Empfehlung: so lassen und im Bericht der Datenprüfung zeigen, wie viel
    die Form zwischen Einträgen springt; eine Korrektur wäre Fachkern-Arbeit mit Simulation (wie B19).
11. **Saisons im Segment** heißen alle „Saison 25/26“ (das Konzept kürzte ab der zweiten auf „25/26“), wie im Formular
    eines Ziels.
12. **Werkzeug unter `tools/` statt `scripts/transfer/`:** `apps/spiegel/scripts/` ist für den Autopiloten geschützt;
    das Werkzeug ruft `psql` selbst. Stufe 3 kann denselben Weg nehmen.
13. **Konten mit Wertung in Zehnteln:** Scheiben aus Treffsicher mit ganzen Ringen haben keinen Ø in Zehnteln und zählen
    in einer Familie mit Wertung Zehntel nicht (Grundlage „ohne Scheibe“). Beim größten Konto (Luftpistole, ganze
    Ringe) ohne Folge.
14. **Reiter:** Bis `TabBar` im Basisbranch ist, wischt die heutige Leiste in sich, ohne dass der gewählte Reiter ins Bild
    rückt (Aufgabe 21 holt das nach). Nach dem Rebase auf `main` mit Teil R meldet `consistency-check.sh` die Leiste des
    Tagebuchs als „Reiterleiste von Hand“, bis Aufgabe 21 erledigt ist; der Basisbranch darf vorher nicht ins Release.
