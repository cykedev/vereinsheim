# Plan: Seite eines Zeitraums (L3)

- Konzept: `vault/spiegel/spiegel-langzeit.md` (Bauschritt L3), Roadmap SP-2.1 und SP-2.2
- Fachkern: L2 (`packages/shot-core/src/analysis/period.ts`, `records.ts`), Hilfe: Thema `period` in `shot-help`
- Branch: `feat/spiegel-zeitraum-seite`

## Kontext

L2 hat den Fachkern für viele Scheiben gebracht, aber keine Oberfläche. L3 baut die Seite eines Zeitraums aus
echten Bausteinen in `packages/shot-ui` und zeigt sie im Labor mit einer erfundenen Saison. Die Seite folgt der
Seite einer Scheibe (Konzept, Entscheidung 3):

| Seite einer Scheibe | Seite eines Zeitraums |
|---|---|
| Kopf mit Satz, Ergebnis-Box | Kopf mit Zeitraum, Filtern, Satz; Ergebnis-Box mit Vergleich |
| Scheibe fest im Bild, Serien darunter | Verlauf fest im Bild, Umfang je Woche darunter |
| Ablesung des Schusses | Ablesung der Scheibe mit kleiner Scheibe und „Scheibe öffnen“ |
| Schusstabelle | Liste der Scheiben |
| Zahlen, Analyse | Zahlen mit Vergleichswert, Analyse (Gegen deinen Schnitt, Rekorde) |

Nicht in L3: Langzeit-Trefferbild (L4), Erkenntnisse und weitere Reiter der Analyse (L5), Zeiträume speichern
(L6), Kalender (T7), Trendsteigung (T4), die App selbst.

## Entscheidungen

Vorschläge aus dem Konzept zu Ende gedacht. Wer etwas anders will, sagt es bei der Freigabe.

- **D1 Rahmen:**
  - Eigener Rahmen `PeriodPage` im Gerüst von `CardPage`: dieselben Spalten (`PAGE_COLUMNS`), derselbe Block für
    Abschnitte (`SectionBlock`, aus `CardPage` herausgelöst).
  - Ab 768 px steht links der Verlauf fest im Bild (`md:sticky md:top-14`), darunter der Umfang je Woche. Rechts
    stehen Ergebnis-Box, Ablesung und Liste der Scheiben; die Liste füllt die Höhe und scrollt in sich. Darunter
    folgen in voller Breite Zahlen und Analyse.
  - `CardPage` ändert sich nur um den herausgelösten Block. Eine allgemeine Seite für beide wäre möglich, wäre
    aber ein Umbau der geprüften Seite einer Scheibe ohne Nutzen für L3.
- **D2 Sprungleiste:**
  - Die Leiste heißt „Verlauf · Scheiben · Zahlen · Analyse“, mit den Ankern `#verlauf`, `#scheiben`, `#zahlen`
    und `#analyse`.
  - `SectionNav` und `useActiveSection` bekommen die Abschnitte als Parameter. Ohne Angabe gelten die der Scheibe.
- **D3 Reine Funktionen getrennt von React:**
  - `period/calendar.ts`: Zeiträume, Wochen und Monate.
  - `period/state.ts`: der Zustand der Seite als Reducer.
  - `period/model.ts`: alles, was die Seite zeigt, aus dem Fachkern.
  - `period/sentence.ts`: der Satz im Kopf.
  - Die Komponenten zeichnen nur, was diese Funktionen liefern.
- **D4 Zeitraum-Wähler:**
  - Ein Chip im Kopf („Letzte 90 Tage“) öffnet ein Blatt (`Sheet`). Auf dem Telefon kommt es von unten, ab 768 px
    steht es rechts.
  - **Auswahl:** rollend „Letzte 30 Tage“, „Letzte 90 Tage“ (Vorgabe), „Letzte 12 Monate“ und „Alles“; dazu die
    benannten Zeiträume (Props) und frei „von … bis“ mit zwei Datumsfeldern.
  - **Rollend heißt:** Beginn der Scheibe nach `now − N · 24 h` und nicht nach `now`.
  - **Frei und benannt:** vom Beginn des ersten Tags bis zum Ende des letzten, in der Anzeige-Zeitzone. Ein
    benannter Zeitraum ohne Ende läuft bis `now`.
  - „Als Zeitraum speichern“ kommt mit L6.
- **D5 Filter im Kopf:**
  - Familie: Pflicht, ein Segment-Umschalter mit den Familien, die es gibt.
  - Art: Alle, Training oder Wettkampf.
  - Schalter-Chip „mit Training nur aus Probe“, aus (D8 aus L2: `includeProbeOnly`).
  - Wertung: `ScoringSwitch` in der Ergebnis-Box wie auf der Scheibe.
- **D6 Vergleich:**
  - Im selben Blatt „vergleichen mit“: ohne (Vorgabe), „Zeitraum davor“ (gleich lang, direkt davor) oder ein
    benannter Zeitraum.
  - Das Urteil kommt aus `comparePeriods`. „bedeutsam“ steht nur neben „höher“ oder „tiefer“ (L2, B19).
  - Ohne Urteil steht „nicht nachweisbar“, unter fünf Scheiben je Seite „zu wenige Scheiben“.
  - „höher“ und „tiefer“ beschreiben die Zahl. Bei `better` „higher“ oder „lower“ steht dazu „besser“ oder
    „schwächer“, bei „none“ nichts.
- **D7 Verlauf:**
  - **Kennzahl:** Ein Segment-Umschalter darüber bietet „Ø je Schuss“ (Vorgabe), „σ“, „Zehner“ (Zehnerquote) und
    „Tempo“ an. Es sind nur Kennzahlen, die nicht an der Schusszahl hängen (`nSensitive: false`).
  - **„je Scheibe“:** x ist das Datum mit Strichen je Monat. Jede Scheibe ist ein Punkt, ein Wettkampf hat einen
    Ring, eine Scheibe nur aus Probe ist hohl. Dazu kommen der gleitende Schnitt als Linie (gestrichelt, solange
    „bisher“) und das Formband als Fläche.
  - **„je Monat“ (T5):** der Median als Punkt, P10–P90 als Balken, die Zahl der Scheiben darunter.
  - **Vorgabe der Darstellung:** unter 60 Scheiben „je Scheibe“, ab 60 „je Monat“, bis der Schütze selbst wählt.
  - **Mit Vergleich:** Beide Zeiträume liegen auf einer relativen Achse („Scheibe 1, 2, 3 … im Zeitraum“). Der
    Vergleich ist `muted-foreground`, zeigt nur Punkte und Schnitt und hat kein Band. Eine Legende nennt beide
    Zeiträume. „je Monat“ gibt es dann nicht.
  - **Farben:** nur Design-2-Tokens (`primary` für den Zeitraum, `muted-foreground` für den Vergleich), kein neuer
    Token.
- **D8 Lineal und Wahl:**
  - **Lineal:** wie L1 (`useRuler`, Zeile über dem Diagramm, „Werte als Tabelle“).
  - **„je Scheibe“:** Das Lineal wählt die Scheibe der Seite. Diesen Zustand teilen Verlauf, Liste und Ablesung
    (`chosen`). Eine in der Liste gewählte Scheibe steht im Lineal (`preset`).
  - **„je Monat“:** Das Lineal liest nur den Monat ab.
  - **Ohne Wahl:** Die Ablesung zeigt die neueste Scheibe, wie auf der Scheibe den letzten Schuss.
- **D9 Ablesung einer Scheibe:**
  - **Inhalt:** Datum, Art, Wert der Kennzahl, Schusszahl und Abstand zum gleitenden Schnitt an dieser Stelle.
    Dazu kommen die kleine Scheibe der Wertung und „Scheibe öffnen“.
  - **Kleine Scheibe:** `MiniTarget`, aus `SeriesStrip` herausgelöst, damit es nur eine Zeichnung gibt.
  - **Telefon:** als Zeile unter dem Verlauf (`CardLine`), mit „Scheibe öffnen“.
- **D10 Liste der Scheiben:**
  - **Zeile:** neueste oben; Datum, Art, Wert, Abstand zum Schnitt und Schusszahl.
  - **Wahl:** Die Zeile wählt die Scheibe, wie die Schusstabelle den Schuss, und holt den Verlauf mit Rücksprung
    ins Bild (`useReturnJump`).
  - **Telefon:** zehn Zeilen und „Alle zeigen“. Ab 768 px füllt die Liste die Höhe und scrollt in sich.
- **D11 Zahlen:**
  - **Kacheln:** Ø je Schuss, Zehnerquote, σ, Streuung x, Streuung y, Tempo und Tempo-Streuung, jeweils als Mittel
    der Werte je Scheibe (Einheit Scheibe, wie `comparePeriods`), darunter „n Scheiben“.
  - **Mit Vergleich:** je Kachel A, B, Δ und das Urteil nach D6.
  - **Ohne Wert:** Ein Strich und der Grund („keine Scheibe mit Wert“).
- **D12 Analyse in L3:**
  - Zwei Karten im Raster der Analyse: „Gegen deinen Schnitt“ (C4) und „Rekorde“ (R1–R8, in der Wertung und Art
    der Seite, mit Datum).
  - Ein Rekord wählt beim Antippen seine Scheibe, wenn sie im Zeitraum liegt. Rekorde gelten über alle Scheiben
    der Familie, nicht nur über die des Zeitraums.
  - Reiter folgen mit L4 und L5.
- **D13 Ergebnis-Box:**
  - Ø je Schuss als Mittel der Scheiben, groß; darunter Scheiben und Schüsse und die beste Scheibe (höchster Ø je
    Schuss, mit Datum).
  - **Mit Vergleich:** die Zeile „+0,08 gegen Zeitraum davor · höher, besser · bedeutsam“ bzw. „nicht
    nachweisbar“, dazu ein „?“ zu `zeitraum-vergleich`.
  - Darunter die Wertung.
- **D14 Satz im Kopf:**
  - Aus dem Vergleich, wenn einer gewählt ist, sonst aus „gegen deinen Schnitt“, sonst keiner (`periodSentence`).
  - Er sagt „nachweisbar“ nur mit Urteil, sonst „nicht nachweisbar“.
- **D15 Umfang je Woche (T6):**
  - Säulen der Schüsse je ISO-Woche in der Anzeige-Zeitzone, unter dem Verlauf.
  - Das Lineal liest ab: „KW 29: 140 Schuss, 3 Scheiben, 2 Tage“. Dazu „Werte als Tabelle“ und ein „?“ zu
    `trainingsumfang`.
- **D16 Datum und Zeitzone:**
  - Alles über `@vereinsheim/lib/format` mit der Zeitzone als Prop.
  - Neu dort: `formatMonthShort` („Jul“), `formatMonthYear` („Juli 2026“) und `zonedDayStartMs` (Beginn eines
    Kalendertags in einer Zone, auch am Tag der Zeitumstellung).
  - Monate und Tage kommen aus `formatIsoDate`, ISO-Wochen rechnet `calendar.ts` ohne `Intl`.
- **D17 Labor:**
  - **Umschalter:** „Ansicht: Scheibe | Zeitraum“ im Labor-Kopf, gemerkt in `labor.mode`.
  - **Saison (`season.ts`):** erfunden, mit festem Seed.
    - Luftgewehr: etwa 80 Scheiben vom 6. April bis 27. September 2026.
    - Training mit 20 bis 60 Schuss, einige nur Probe; Wettkampf alle zwei bis drei Wochen mit 40 Schuss; eine
      Scheibe mit `nur-pdf`.
    - Formknick im Juni (σ 1,9 statt 1,5 mm), Munitionswechsel am 1. August (danach σ 1,3 mm).
    - Dazu Luftpistole mit etwa 40 Scheiben.
  - **Benannte Zeiträume:** „Vorbereitung Landesmeisterschaft“ (1. Mai bis 30. Juni) und „Neue Munition“ (ab 1.
    August, läuft).
  - **„Jetzt“:** fest der 30. September 2026, 12:00 Uhr MESZ; Zeitzone Europe/Berlin.
  - **Wechsel zwischen den Seiten:** „Scheibe öffnen“ zeigt die Scheibe in der Ansicht „Scheibe“. „Zurück zum
    Zeitraum“ kehrt mit Filtern, Wahl und Scrollstelle zurück; der Zustand der Zeitraum-Seite lebt dafür in `App`.
- **D18 Hilfe:**
  - **„?“ der Seite:** Verlauf → `verlauf-und-form`, Umfang → `trainingsumfang`, Vergleich → `zeitraum-vergleich`,
    die Karten → `gegen-den-schnitt` und `rekorde`, Kacheln über `helpForMetric`.
  - **Labor-Prüfung:** „jedes Thema hat seinen Platz“ nimmt die Themen über viele Scheiben wieder auf, gesucht auf
    der Seite des Zeitraums. Der shot-ui-Test der Analyse einer Scheibe schließt sie weiter aus.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/lib/src/format.ts`, `format.test.ts` | `formatMonthShort`, `formatMonthYear`, `zonedDayStartMs` |
| `packages/shot-ui/src/period/calendar.ts` (+ Test) | neu: Zeiträume, ISO-Woche, Monat |
| `packages/shot-ui/src/period/state.ts` (+ Test) | neu: `periodReducer`, `initialPeriodState` |
| `packages/shot-ui/src/period/model.ts` (+ Test) | neu: `periodModel`, `PERIOD_CHART_METRICS`, `PERIOD_TILE_KEYS` |
| `packages/shot-ui/src/period/sentence.ts` (+ Test) | neu: `periodSentence`, `verdictText` |
| `packages/shot-ui/src/target/MiniTarget.tsx` (+ Test), `series/SeriesStrip.tsx` | kleine Scheibe herausgelöst |
| `packages/shot-ui/src/layout/SectionBlock.tsx`, `CardPage.tsx`, `PeriodPage.tsx` (+ Test) | Rahmen |
| `packages/shot-ui/src/layout/sections.ts`, `SectionNav.tsx`, `useActiveSection.ts` (+ Tests) | Abschnitte als Parameter, `PERIOD_SECTIONS` |
| `packages/shot-ui/src/period/PeriodChart.tsx` (+ Test) | neu: Verlauf |
| `packages/shot-ui/src/period/VolumeChart.tsx` (+ Test) | neu: Umfang je Woche |
| `packages/shot-ui/src/period/CardReadout.tsx` (+ Test) | neu: `CardReadout`, `CardLine` |
| `packages/shot-ui/src/period/CardList.tsx` (+ Test) | neu: Liste der Scheiben |
| `packages/shot-ui/src/period/PeriodHeader.tsx`, `PeriodPicker.tsx`, `PeriodResult.tsx` (+ Tests) | neu: Kopf, Wähler, Ergebnis-Box |
| `packages/shot-ui/src/period/PeriodTiles.tsx`, `PeriodInsights.tsx` (+ Tests) | neu: Zahlen, Analyse |
| `packages/shot-ui/package.json` | Exporte der neuen Dateien |
| `tools/labor/src/season.ts` (+ Test) | neu: Saison |
| `tools/labor/src/App.tsx`, `CardView.tsx`, `PeriodView.tsx`, `testHook.ts` | Ansichten |
| `tools/labor/pruefung.js` | Prüfungen der Zeitraum-Seite |
| `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`, `vault/architecture/architecture.md` | Doku |
| `vault/spiegel/spiegel-langzeit.md`, `vault/spiegel/spiegel-roadmap.md` | L3 erledigt |

## Required Docs

- `packages/shot-ui/CLAUDE.md` (alle Regeln, besonders Seite aus `CardPage`, Diagramme, Lineal, Telefon,
  Container-Abfragen, Farben)
- `tools/labor/CLAUDE.md` (Prüfung, Eigenheiten von Headless-Chrome, Artifact)
- `packages/shot-core/CLAUDE.md` („Über viele Scheiben“, „Ehrlich statt scheingenau“)
- `vault/spiegel/spiegel-langzeit.md`, `vault/conventions.md` §3, §6, §9 und §10
- Vor dem ersten Diagramm-Code: Skill `dataviz` laden; wo er von `shot-ui` abweicht (Schrift, Punkte, Farben aus
  Design 2), gilt `shot-ui`.

## Aufgaben

### Task 1: Datumsformate in `@vereinsheim/lib/format` (Tests zuerst)

```ts
/** "Jul" — Achse mit Monatsauflösung */
export function formatMonthShort(date: Date, timeZone: string): string
/** "Juli 2026" */
export function formatMonthYear(date: Date, timeZone: string): string
/** Beginn des Kalendertags `isoDate` ("2026-07-15") in der Zone, in ms (UTC) */
export function zonedDayStartMs(isoDate: string, timeZone: string): number
```

`zonedDayStartMs` nimmt Mitternacht UTC des Tags, holt den Versatz der Zone zu dieser Zeit über
`formatToParts` und prüft ihn an der Kandidatenzeit nach. So stimmt er auch am Tag der Zeitumstellung.

Tests mit Europe/Berlin:
- `formatMonthShort(15.07.2026)` „Jul“, `(15.09.2026)` „Sep“; `formatMonthYear(15.07.2026)` „Juli 2026“.
- `zonedDayStartMs("2026-07-15")` = `Date.UTC(2026, 6, 14, 22)` (Sommerzeit).
- `zonedDayStartMs("2026-01-15")` = `Date.UTC(2026, 0, 14, 23)` (Winterzeit).
- `zonedDayStartMs("2026-03-29")` = `Date.UTC(2026, 2, 28, 23)`: Am Tag der Umstellung beginnt der Tag noch in
  der Winterzeit.
- `zonedDayStartMs("2026-10-25")` = `Date.UTC(2026, 9, 24, 22)`.
- Dazu UTC als Gegenprobe: `zonedDayStartMs("2026-07-15", "UTC")` = `Date.UTC(2026, 6, 15)`.

### Task 2: `period/calendar.ts` (Tests zuerst)

```ts
export const DAY_MS = 86_400_000
export type PeriodChoice =
  | { type: "rolling"; days: 30 | 90 | 365 }
  | { type: "all" }
  | { type: "named"; id: string }
  | { type: "free"; from: string; to: string } // ISO-Tage, beide eingeschlossen
export type CompareChoice = { type: "none" } | { type: "previous" } | { type: "named"; id: string }
export interface NamedPeriod { id: string; name: string; from: string; to: string | null }
export interface DateRange { fromMs: number; toMs: number; label: string }
export const ROLLING_CHOICES: readonly { choice: PeriodChoice; label: string }[]
// „Letzte 30 Tage“, „Letzte 90 Tage“, „Letzte 12 Monate“, „Alles“
export function resolveRange(
  choice: PeriodChoice,
  context: { nowMs: number; timeZone: string; named: readonly NamedPeriod[]; firstMs: number | null }
): DateRange
export function compareRange(
  compare: CompareChoice,
  range: DateRange,
  context: { nowMs: number; timeZone: string; named: readonly NamedPeriod[] }
): DateRange | null
export const inRange = (atMs: number, range: DateRange) => atMs >= range.fromMs && atMs < range.toMs
export function isoWeekKey(isoDate: string): string // "2026-W29"
export const weekLabel = (key: string) => `KW ${Number(key.slice(6))}`
```

- **Rollend:** `fromMs = nowMs − days · DAY_MS`, `toMs = nowMs + 1`.
- **„Alles“:** `fromMs = firstMs ?? nowMs`, `toMs = nowMs + 1`, Name „Alles“.
- **Frei und benannt:** vom Beginn des ersten Tags (`zonedDayStartMs`) bis zum Beginn des Tags nach dem letzten.
  Ein Ende `null` gilt als `nowMs + 1`. Der Name ist der des Zeitraums bzw. „15.07.2026 – 30.09.2026“
  (`formatDateOnly`).
- **„Zeitraum davor“:** gleich lang, endet am Beginn des Zeitraums, Name „Zeitraum davor“. Ein unbekannter
  benannter Zeitraum ergibt null.

Tests mit `now = Date.UTC(2026, 8, 30, 10)`:
- 90 Tage beginnen bei `now − 90 · DAY_MS`.
- Frei 2026-07-01 bis 2026-07-31 ergibt `[Date.UTC(2026, 5, 30, 22), Date.UTC(2026, 6, 31, 22))`.
- „Neue Munition“ von 2026-08-01 ohne Ende reicht bis `now + 1`.
- „Zeitraum davor“ zu 90 Tagen beginnt bei `now − 180 · DAY_MS`.
- `inRange` schließt den Anfang ein und das Ende aus.
- ISO-Wochen:
  - `isoWeekKey("2026-07-15")` ist „2026-W29“ (Mittwoch, Tag 196).
  - `isoWeekKey("2027-01-01")` ist „2026-W53“, denn 2026 beginnt an einem Donnerstag.
  - `isoWeekKey("2026-12-28")` ist „2026-W53“.
  - `isoWeekKey("2026-01-01")` ist „2026-W01“.
  - `isoWeekKey("2027-01-04")` ist „2027-W01“.
  - `weekLabel("2026-W09")` ist „KW 9“.

### Task 3: `period/state.ts` (Tests zuerst)

```ts
export type PeriodMetricKey = "result.decimalMean" | "group.sigma" | "result.tensRate" | "time.intervalMedian"
export type CardKind = "all" | "training" | "competition"
export interface PeriodState {
  choice: PeriodChoice
  compare: CompareChoice
  family: string
  kind: CardKind
  includeProbeOnly: boolean
  scoring: Scoring
  metric: PeriodMetricKey
  /** Darstellung des Verlaufs; null: nach der Zahl der Scheiben (D7) */
  view: "cards" | "months" | null
  /** gewählte Scheibe (Id); null: keine, die Ablesung zeigt die neueste */
  chosen: string | null
}
export type PeriodAction =
  | { type: "setChoice"; choice: PeriodChoice }
  | { type: "setCompare"; compare: CompareChoice }
  | { type: "setFamily"; family: string }
  | { type: "setKind"; kind: CardKind }
  | { type: "setIncludeProbeOnly"; include: boolean }
  | { type: "setScoring"; scoring: Scoring }
  | { type: "setMetric"; metric: PeriodMetricKey }
  | { type: "setView"; view: "cards" | "months" }
  | { type: "choose"; id: string | null }
export function initialPeriodState(partial: Partial<PeriodState> & { family: string }): PeriodState
export function periodReducer(state: PeriodState, action: PeriodAction): PeriodState
```

- **Vorgaben:** 90 Tage, ohne Vergleich, Art „all“, ohne nur Probe, Zehntel, Ø je Schuss, `view` null,
  `chosen` null.
- **`chosen` fällt weg**, wenn sich die Menge der Scheiben ändert: Zeitraum, Familie, Art oder nur Probe. Bei
  Vergleich, Wertung, Kennzahl und Darstellung bleibt es.
- **`choose`** mit der schon gewählten Id hebt die Wahl auf, wie ein zweites Tippen auf denselben Schuss.

Tests: die Vorgaben, jede Aktion, die Fälle, in denen `chosen` wegfällt oder bleibt, und das Aufheben.

### Task 4: `period/model.ts` und `period/sentence.ts` (Tests zuerst)

```ts
export const PERIOD_CHART_METRICS: readonly { key: PeriodMetricKey; label: string }[]
// Ø je Schuss · σ · Zehner · Tempo
export const PERIOD_TILE_KEYS = ["result.decimalMean", "result.tensRate", "group.sigma", "group.sdX",
  "group.sdY", "time.intervalMedian", "time.tempoSpread"] as const
export const MONTH_VIEW_FROM = 60
export interface PeriodTile {
  key: string; label: string; unit: MetricUnit; decimals: number; better: "higher" | "lower" | "none"
  value: number | null; n: number
  compare: { value: number | null; n: number; comparison: PeriodComparison | null } | null
}
export interface PeriodModel {
  range: DateRange
  compareRange: DateRange | null
  /** Scheiben im Zeitraum nach Art, in ihrer Folge (`startedAtMs`, Id) */
  cards: PeriodCard[]
  metric: Readonly<MetricDefinition> // in der Wertung der Seite
  values: CardValue[]
  trend: { points: TrendPoint[]; spread: number | null }
  compareValues: CardValue[] | null
  comparison: PeriodComparison | null
  view: "cards" | "months"
  months: (PeriodBucket & { label: string; atMs: number })[]
  weeks: (VolumeBucket & { label: string })[]
  ownAverage: OwnAverage | null
  records: PeriodRecords
  summary: { mean: number | null; cards: number; shots: number; best: CardValue | null }
  tiles: PeriodTile[]
  /** gewählte oder neueste Scheibe mit ihrem Punkt im Verlauf; null ohne Scheiben */
  reading: { card: PeriodCard; point: TrendPoint | null; chosen: boolean } | null
}
export function periodModel(input: {
  cards: readonly PeriodCard[] // alle Scheiben einer Familie
  state: PeriodState
  nowMs: number
  timeZone: string
  named: readonly NamedPeriod[]
}): PeriodModel
```

- **Zeitraum:** aus `resolveRange` mit `firstMs` der frühesten Scheibe. Die Scheiben filtert `inRange` und die
  Art.
- **Werte:** `values` aus `cardValues(cards, metric, scoring, { includeProbeOnly })`, `trend` aus `periodTrend`.
- **Monate und Wochen:**
  - `months` aus `periodBuckets` mit dem Monat aus `formatIsoDate`; Name `formatMonthYear`, `atMs` = Beginn des
    Monats.
  - `weeks` aus `trainingVolume` mit `isoWeekKey` und dem Tag aus `formatIsoDate`.
- **Vergleich:** `compareValues` und `comparison` (`comparePeriods(values, compareValues)`) nur mit
  `compareRange`. Mit Vergleich ist `view` immer „cards“.
- **Darstellung:** `view` aus `state.view`, sonst „months“ ab `MONTH_VIEW_FROM` Werten.
- **Eigener Schnitt und Rekorde:**
  - `ownAverage` = `againstOwnAverage(values)`.
  - `records` = `periodRecords` über **alle** Scheiben der Familie, in der Wertung und Art der Seite, mit
    `includeProbeOnly` (D12).
- **`summary`:**
  - `mean` ist das Mittel der Ø je Schuss je Scheibe (in der Wertung der Seite).
  - `cards` zählt die Scheiben mit Wert, `shots` die Wertungsschüsse dieser Scheiben.
  - `best` ist die Scheibe mit dem höchsten Ø je Schuss; bei Gleichstand gilt die frühere.
- **`tiles`:** je Schlüssel das Mittel der Werte je Scheibe und `n`. Mit Vergleich kommen die Werte der zweiten
  Seite dazu und `comparePeriods` je Kachel.
- **`reading`:** `state.chosen`, wenn die Scheibe noch im Zeitraum liegt, sonst die neueste.

`sentence.ts`:

```ts
/** „höher, besser · bedeutsam“, „nicht nachweisbar“, „zu wenige Scheiben“ (D6) */
export function verdictText(comparison: PeriodComparison, better: "higher" | "lower" | "none"): string
export function periodSentence(model: PeriodModel): string | null
```

- **Mit Vergleich:**
  - Mit Urteil: „Dein Ø je Schuss liegt 0,08 höher als im Zeitraum davor, nachweisbar.“
  - Ohne Urteil: „… nicht nachweisbar.“
  - Unter fünf je Seite: „Für einen Vergleich mit dem Zeitraum davor sind es zu wenige Scheiben.“
- **Sonst gegen den eigenen Schnitt:** „Deine letzte Scheibe lag 0,05 über deinem Schnitt der 30 Tage davor.“
- **Sonst** null.
- **Die Kennzahl** ist `metric.label` in Kleinschreibung, wo es passt; der Ø je Schuss heißt immer „Dein Ø je
  Schuss“.

Tests mit sechs von Hand gebauten Scheiben (Luftgewehr, `toMetricShots` wie im Labor, nur Zehntelwerte zählen):
- **Filter:** Werte, Zeitraum und Art.
- **`summary`:** Scheiben mit [100, 100], [90, 92], [95]: `mean` = (10 + 9,1 + 9,5)/3 = 9,5333…, `shots` = 5,
  `best` ist die erste Scheibe.
- **Kacheln:** `tiles[0].value` = 9,5333…, `n` = 3.
- **Vergleich:**
  - Fünf gegen fünf getrennte Scheiben ergeben `comparison.verdict` „higher“ und den Satz „… liegt 5,00 höher …,
    nachweisbar.“
  - Bei vier je Seite gibt es keinen Test, und der Satz nennt zu wenige Scheiben.
- **`view`:** Ab 60 Werten ist sie „months“, außer `state.view` sagt „cards“ oder es gibt einen Vergleich.
- **`reading`:** Ohne Wahl ist es die neueste Scheibe. Eine Wahl außerhalb des Zeitraums fällt auf die neueste
  zurück.
- **Rekorde:** Sie kommen aus allen Scheiben, auch außerhalb des Zeitraums.
- **`verdictText`:** alle fünf Fälle, auch bei `better` „none“.

### Task 5: `MiniTarget` aus `SeriesStrip` herauslösen

- **`target/MiniTarget.tsx`:**
  - Props `target`, `view: ViewBox`, `shots: readonly MetricShot[]`, `probeCorner?: boolean`, `dim?: boolean`
    und `className`.
  - Es ist die Zeichnung der Kachel aus `SeriesStrip`: Papier, Spiegel, Ringe als Haarlinien, Treffer in
    Ringwert-Farbe, Probe-Ecke. Dazu `aria-hidden`.
- **`SeriesStrip`** nutzt `MiniTarget`; sein Markup bleibt Zeichen für Zeichen gleich.
- **Tests:**
  - Der vorhandene `SeriesStrip.test.tsx` bleibt grün.
  - Ein neuer Test vergleicht das Markup einer Serien-Kachel vor und nach dem Umbau als festen String
    (Charakterisierung; der String wird vor dem Umbau erzeugt und eingefroren).
  - `MiniTarget` zeichnet so viele Treffer, wie es Schüsse mit Lage gibt.

### Task 6: Abschnitte, `SectionBlock`, `PeriodPage`

- **`sections.ts`:** dazu `PERIOD_SECTIONS` mit `verlauf` „Verlauf“, `scheiben` „Scheiben“, `zahlen` „Zahlen“ und
  `analyse` „Analyse“. Ferner `type PeriodSection` und `parsePeriodHash(hash)`.
- **`SectionNav`:**
  - Neue Prop `sections` (Vorgabe `PAGE_SECTIONS`), `active` als `string | null`.
  - `useActiveSection(ids = PAGE_SECTIONS.map(s => s.id))` misst nur Elemente mit diesen Ids in
    `data-section`.
- **`layout/SectionBlock.tsx`:** der Block aus `CardPage`, unverändert; `CardPage` importiert ihn.
- **`layout/PeriodPage.tsx`:** Props `header`, `nav`, `chart` (Abschnitt „verlauf“, trägt selbst
  `data-section="verlauf"` und klebt ab 768 px), `under`, `result`, `aside`, `beside`, `below` und `empty`, wie
  `CardPage`, nur ohne `useTargetFit`.
- **Tests:**
  - `PeriodPage` legt `#verlauf` mit `md:sticky` an und zeigt die Box mit `max-md:hidden`. Mit `empty` stehen nur
    Kopf und Hinweis da.
  - `SectionNav` zeigt mit `PERIOD_SECTIONS` die vier Anker.
  - Die vorhandenen Tests von `CardPage` und `SectionNav` bleiben grün.
  - `activeSection` mit Ids der Zeitraum-Seite.

### Task 7: `PeriodChart` (Verlauf)

Props: `width`, `model` (Ausschnitt `values`, `trend`, `months`, `view`, `compareValues`, `range`,
`compareRange`, `metric`, `cards`), `timeZone`, `chosen: string | null`, `onChoose(id | null)`.

- **„je Scheibe“:**
  - **Achse:** x linear von `range.fromMs` bis `range.toMs`, Monatsstriche mit `formatMonthShort`. y nach
    `niceStep` über Werte und Band.
  - **Zeichen:**
    - Training: gefüllter Punkt `r 4`, `primary`, Rand `shot-edge`.
    - Wettkampf: zusätzlich ein Ring `r 7` in `foreground-2`.
    - Nur Probe: hohl.
  - **Schnitt und Band:** Der Schnitt ist ein Pfad, gestrichelt bis zum ersten vollen Fenster. Das Band ist eine
    Fläche `primary` mit `fillOpacity 0.12` zwischen `low` und `high`, nur wo es eins gibt.
- **„je Monat“:**
  - x je Monat gleichmäßig verteilt.
  - Der Median ist ein Punkt, P10–P90 ein Balken (Breite 3, gerundet). Die Zahl der Scheiben steht unter der
    Achse.
- **Vergleich:**
  - Die x-Achse ist die Nummer im Zeitraum, 1 bis max(n).
  - Die Punkte des Vergleichs sind hohl und `muted-foreground`, sein Schnitt ist gestrichelt.
  - Eine Legende über dem Diagramm nennt beide Namen.
- **Lineal:**
  - `useRuler` über die x-Positionen (Scheiben bzw. Monate).
  - „je Scheibe“: `preset` ist der Index von `chosen`, die Wahl ruft `onChoose`. Die Zeile lautet
    „12.07.2026 · 10,21 · Schnitt 10,18“, ein Wettkampf mit „Wettkampf · “ davor.
  - „je Monat“: „Juli 2026 · 14 Scheiben · Median 10,20 · Boden 10,13 · Decke 10,28“, unter fünf Scheiben „Boden
    und Decke ab 5 Scheiben“.
  - Darunter „Werte als Tabelle“.
- **Ohne zwei Werte:** ein Satz statt des Diagramms („Für einen Verlauf braucht es zwei Scheiben mit Wert.“).
- **Tests** (`renderToStaticMarkup`):
  - die Zahl der Punkte, der Ring bei Wettkampf, der Pfad des Schnitts und die Fläche des Bands;
  - die Balken je Monat;
  - im Vergleich zwei Reihen und die Legende;
  - die Tabelle mit allen Scheiben;
  - der Satz bei einer Scheibe.

### Task 8: `VolumeChart` (Umfang je Woche)

- **Props:** `width`, `weeks`, `onHelp?`.
- **Säulen:** je Woche eine Säule der Schüsse in `primary` mit `fillOpacity 0.45`. Unter der Achse steht die KW
  jeder vierten Woche.
- **Lineal:** „KW 29: 140 Schuss, 3 Scheiben, 2 Tage“; dazu „Werte als Tabelle“.
- **Tests:** Zahl der Säulen, Höhe der höchsten, Tabelle.

### Task 9: `CardReadout` und `CardLine`

- **`CardReadout`:**
  - Props `card`, `target`, `point: TrendPoint | null`, `metric`, `timeZone`, `chosen`, `onOpen`.
  - Inhalt:
    - Kopf: „Gewählte Scheibe“ bzw. „Neueste Scheibe“.
    - Datum (`formatDateOnly`), Art und Wert mit Einheit.
    - „n Schuss“.
    - Abstand zum Schnitt (`formatSigned`), mit „bisher“, solange das Fenster nicht voll ist.
    - Im Band oder außerhalb: „liegt im Formband“ bzw. „liegt außerhalb des Formbands“, nur wenn es ein Band
      gibt.
    - `MiniTarget` der Wertung (`groupView` über die Treffer), 96 px.
    - Knopf „Scheibe öffnen“.
- **`CardLine`** (Telefon): „12.07. · 10,21 · +0,03 zum Schnitt“ und „Scheibe öffnen“.
- **Tests:** die Texte für gewählt und neueste, mit und ohne Band, Wettkampf, Knopf und Zeile.

### Task 10: `CardList`

- **Props:** `cards`, `values`, `trend`, `metric`, `timeZone`, `chosen`, `onChoose`.
- **Tabelle:**
  - Neueste oben. Spalten: Datum, Art (Kürzel „T“, „W“, „P“ für nur Probe, mit Namen im `title` und als Text für
    Screenreader), Wert, Δ zum Schnitt, Schuss.
  - Die gewählte Zeile ist `aria-selected`. Die Zeile ist ein Knopf wie in `ShotTable` (Tastatur).
  - Scheiben ohne Wert stehen mit „–“ und „ohne Wert“.
- **Telefon:**
  - Unter 768 px zehn Zeilen, darunter „Alle zeigen“ („Weniger zeigen“). Ein `max-md:`-Zustand, keine zweite
    Liste.
  - Ab 768 px alle Zeilen, scrollt in sich (`md:min-h-0 md:overflow-auto`).
- **Tests:**
  - Reihenfolge, Δ-Vorzeichen und Markierung der gewählten Zeile.
  - „Alle zeigen“ bei mehr als zehn, nicht bei zehn.

### Task 11: `PeriodPicker`, `PeriodHeader`, `PeriodResult`

- **`PeriodPicker`:**
  - Ein Chip mit dem Namen des Zeitraums und „▾“ öffnet ein `Sheet` „Zeitraum“.
  - Inhalt des Blatts:
    - Gruppe „Zeitraum“ (Radioknöpfe): die rollenden Vorgaben, die benannten Zeiträume mit „von – bis“ bzw. „läuft
      seit“, „Frei“ mit zwei `input type="date"` (Tokens `input`, `border`, `ring`).
    - Gruppe „Vergleichen mit“: „ohne“, „Zeitraum davor“, die benannten.
    - „Übernehmen“: übernimmt und schließt.
  - Frei wird erst mit beiden Daten und von ≤ bis wählbar.
- **`PeriodHeader`:**
  - Titel (Name des Zeitraums) und Metazeile „Luftgewehr · 34 Scheiben · 01.07.2026 – 30.09.2026“.
  - Darunter in einer Reihe, die umbricht: der Wähler, der Vergleich als Text („mit Zeitraum davor“) mit „×“ zum
    Entfernen, `Segmented` Familie, `Segmented` Art und `ToggleChip` „mit Training nur aus Probe“.
  - Auf dem Telefon das Ergebnis, dann der Satz.
- **`PeriodResult`:**
  - `summary.mean` groß mit Einheit, „34 Scheiben · 1 240 Schuss“ und „beste Scheibe 10,34 am 12.07.2026“.
  - Mit Vergleich: „+0,08 gegen Zeitraum davor“ und `verdictText`, dazu `HelpButton` „zeitraum-vergleich“.
  - Darunter `ScoringSwitch`.
- **Tests:**
  - Der Chip öffnet das Blatt.
  - Das Blatt nennt alle Vorgaben und benannten Zeiträume. „Übernehmen“ meldet Wahl und Vergleich, frei erst mit
    gültigen Daten.
  - Kopf mit und ohne Vergleich.
  - Ergebnis mit und ohne Vergleich sowie ohne Scheiben („–“ und „keine Scheibe mit Wert“).

### Task 12: `PeriodTiles` und `PeriodInsights`

- **`PeriodTiles`:**
  - Kacheln im Stil von `MetricTiles` (Container-Spalten, `HelpButton` über `helpForMetric`): Wert und Einheit,
    „n Scheiben“.
  - Mit Vergleich: „A 10,21 · B 10,13“, „Δ +0,08“ und `verdictText`.
- **`PeriodInsights`:** zwei `AnalysisCard`.
  - **„Gegen deinen Schnitt“** (`help="gegen-den-schnitt"`):
    - Schnitt der 30 Tage davor (n), Δ und Perzentil unter den letzten 50.
    - Ohne Wert der Grund: „ab 3 Scheiben in den 30 Tagen davor“, „ab 10 Scheiben“.
  - **„Rekorde“** (`help="rekorde"`):
    - Zeilen R1 bis R8 mit Wert, Datum und Detail.
    - Je Schusszahl bzw. Serienlänge eine Zeile („Ergebnis 40 Schuss“, „beste Serie zu 10“).
    - Ein Knopf je Zeile wählt die Scheibe (`onChoose`), wenn sie im Zeitraum liegt, sonst ist er deaktiviert mit
      „außerhalb des Zeitraums“.
- **Tests:**
  - Kacheln mit und ohne Vergleich.
  - Gegen den Schnitt mit Wert und mit Gründen.
  - Rekorde mit den erwarteten Zeilen aus einem kleinen Satz Scheiben; der Knopf ist deaktiviert außerhalb.

### Task 13: Saison im Labor (`season.ts`, Tests zuerst für die Eckdaten)

```ts
export interface SeasonCard { id: string; family: "lg-10m" | "lp-10m"; raw: RawShot[]; card: PeriodCard }
export const SEASON_NOW_MS = Date.UTC(2026, 8, 30, 10)
export const SEASON_TIME_ZONE = "Europe/Berlin"
export const NAMED_PERIODS: readonly NamedPeriod[]
export function season(): readonly SeasonCard[]
```

- **Plan der Abende:**
  - Fest mit `mulberry32(20261009)`.
  - Luftgewehr dienstags, donnerstags und samstags, mit Lücken: vom 3. bis 16. August Urlaub, sonst fällt jeder
    fünfte Abend aus.
  - Wettkampf an elf festen Samstagen mit 40 Schuss.
  - Training mit 20, 30, 40 oder 60 Schuss.
  - Jede achte Trainingsscheibe nur Probe.
  - Die Scheibe am 23. Mai trägt `nur-pdf`.
- **Streuung:** σ 1,5 mm, vom 1. bis 30. Juni 1,9 mm, ab dem 1. August 1,3 mm. Dazu ein kleiner Versatz je Abend.
- **Luftpistole:** montags und mittwochs, σ 12 mm, mit Wettkampf an sechs Samstagen.
- **Tests:**
  - **Zahlen und Zeitraum:** Luftgewehr 75 bis 85 Scheiben, Luftpistole 35 bis 45. Keine Scheibe nach
    `SEASON_NOW_MS`.
  - **Kennzeichen:** genau eine Scheibe mit `nur-pdf`, mindestens fünf nur aus Probe.
  - **Gleiches Ergebnis:** zweimal `season()` liefert dasselbe.
  - **Effekte sichtbar, Mittel der Scheiben-σ:**
    - Juni größer als Mai.
    - August und September kleiner als April und Mai.
    - „Neue Munition“ gegen „Zeitraum davor“ ergibt im Vergleich der σ „lower“. Den Test darauf gibt es, damit
      das Labor den Fall zeigt.

### Task 14: Labor: zwei Ansichten

- **`CardView.tsx`:**
  - Die heutige Seite einer Scheibe aus `App.tsx`, mit Zustand, Ankern, Analyse und Setzen, unverändert im
    Verhalten.
  - Neue Prop `opened?: { label: string; raw: RawShot[]; target: TargetId }`: Dann zeigt sie diese Scheibe statt
    eines Beispiels, mit „Zurück zum Zeitraum“ im Labor-Kopf.
- **`PeriodView.tsx`:**
  - Die Seite eines Zeitraums aus `PeriodPage` und den Bausteinen aus Task 7 bis 12.
  - Der Zustand kommt als Props (`state`, `dispatch`) aus `App`.
  - Familie ist der Umschalter der Seite, die Scheiben kommen aus `season()`.
  - Die Zeile der Liste wählt und springt mit `useReturnJump` zum Verlauf; „Scheibe öffnen“ ruft `onOpen`.
- **`App.tsx`:**
  - Labor-Kopf mit „Ansicht“, dazu je Ansicht ihre Umschalter (Scheibe, Beispiel, Tippen nur bei „Scheibe“).
  - `useReducer(periodReducer)`.
  - **„Scheibe öffnen“:** merkt `scrollY`, wechselt zu „Scheibe“ mit `opened`.
  - **„Zurück zum Zeitraum“:** wechselt zurück und scrollt an die gemerkte Stelle.
- **`testHook.ts`:** in `window.__labor` dazu `period: { cards, state, model }` und in `tools` `period`
  (`periodModel`, `cardValues`, `comparePeriods`, `periodRecords`, `againstOwnAverage`) zum Nachrechnen.

### Task 15: Skriptprüfung der Zeitraum-Seite

In `pruefung.js` ein neuer Abschnitt „Zeitraum“:

- **Ansicht:** Der Umschalter öffnet die Seite. Die Sprungleiste nennt die vier Abschnitte, `#verlauf` ist
  aktiv.
- **Zahlen nachrechnen:** Die Ergebnis-Box zeigt das Mittel aus `cardValues` über die Scheiben des Zeitraums.
  Das Gleiche gilt für jede Kachel (zwei Nachkommastellen nach `formatValue`).
- **Wähler:**
  - „Letzte 30 Tage“ verkleinert die Liste auf die Scheiben mit Beginn nach `now − 30 Tage`. „Alles“ zeigt alle
    der Familie.
  - „Neue Munition“ setzt den Titel.
- **Vergleich:**
  - „Zeitraum davor“ zeigt in der Box Δ und Urteil, die gegen `comparePeriods` nachgerechnet werden.
  - „bedeutsam“ steht nie ohne „höher“ oder „tiefer“.
  - Der Verlauf zeigt die Legende.
- **Lineal und Liste:**
  - Ein Klick in den Verlauf wählt eine Scheibe. Ablesung und Liste zeigen dieselbe Id.
  - Eine Zeile der Liste wählt die Scheibe und setzt das Lineal.
  - Zweimal dieselbe Zeile hebt die Wahl auf.
- **„je Monat“:** bei „Alles“ (über 60 Scheiben) die Vorgabe. Der Umschalter auf „je Scheibe“ wirkt.
- **Öffnen und zurück:**
  - „Scheibe öffnen“ zeigt die Seite einer Scheibe mit derselben Schusszahl und demselben Ergebnis wie in der
    Liste.
  - „Zurück zum Zeitraum“ stellt Zeitraum, Vergleich und Wahl wieder her.
- **Rekorde:** Der beste Teiler stimmt mit `periodRecords` überein. Die Scheibe mit `nur-pdf` setzt keinen
  Rekord.
- **Telefon 390 und 375 px:**
  - Kein waagrechtes Scrollen.
  - Die Liste zeigt zehn Zeilen und „Alle zeigen“.
  - Die Ablesezeile steht unter dem Verlauf.
  - Der Wähler öffnet als Blatt von unten.
  - Die Sprungleiste hat vier gleiche Felder.
- **Desktop 1280 × 900:**
  - Der Verlauf klebt beim Scrollen bis zum Ende der Liste.
  - Die Liste scrollt in sich.
  - Nichts wird angeschnitten.
- **Hilfe:**
  - Jedes „?“ der Seite öffnet sein Blatt.
  - „jedes Thema hat seinen Platz“ sucht über beide Ansichten und verlangt wieder alle Themen.
- **Abnahme:** `pnpm --filter @vereinsheim/labor pruefen` meldet 0 FAIL. Die Zahl der Prüfungen wächst um
  mindestens 30.

### Task 16: Doku

- **`packages/shot-ui/CLAUDE.md`:**
  - In die Exporttabelle kommen alle neuen Dateien.
  - Eine neue Regel „Seite eines Zeitraums aus `PeriodPage`“ beschreibt Gerüst, Zustand und Modell als reine
    Funktionen, die Wahl (geteilt von Verlauf, Liste und Ablesung) und den Vergleich nur mit Urteil (D6–D10).
- **`tools/labor/CLAUDE.md`:** Ansichten, Saison, „Jetzt“, „Scheibe öffnen“ und zurück, Prüfung.
- **`vault/architecture/architecture.md`:** In der Zeile `shot-ui` stehen jetzt auch die Bausteine der Seite eines
  Zeitraums.
- **`vault/spiegel/spiegel-langzeit.md`:** L3 erledigt, mit Verweis auf diesen Plan. Die Entscheidungen D4, D7,
  D11 und D12 kommen unter „Entwurf“, wo sie das Konzept genauer machen.
- **`vault/spiegel/spiegel-roadmap.md`:** SP-2.1 und SP-2.2 mit „Oberfläche im Labor (L3)“.

## Teststeps

- **Tests zuerst:** Task 1 bis 4 und 13 beginnen mit roten Tests (Funktion fehlt), dann kommt die Umsetzung mit
  Handwerten aus diesem Plan.
- **Gegenproben per Mutation, je eine:**
  - `chosen` bleibt bei `setFamily`: rot.
  - `view` ohne den Vorrang des Vergleichs: rot.
  - `summary.mean` über alle Schüsse statt über Scheiben: rot (Test mit 60 und 5 Schuss).
  - `bedeutsam` ohne Urteil in `verdictText`: rot.
  - `isoWeekKey` mit Wochenbeginn Sonntag: rot.
  - Liste ohne Umkehr der Reihenfolge: rot.
- **Bausteine:** Markup-Tests mit `renderToStaticMarkup`. Die Bedienung prüft das Labor.
- **Gate:** `pnpm check` nach jedem Task, Labor-Prüfung nach Task 14 und 15.

## Verification

- `pnpm check` 37/37 (bzw. mit neuer Aufgabenzahl grün).
- `pnpm --filter @vereinsheim/labor pruefen` meldet 0 FAIL, mit dem neuen Abschnitt „Zeitraum“.
- Sichtprüfung im Browser-Pane (`tools/labor/dist/preview.html`):
  - am Desktop, bei 390 px, hell und dunkel;
  - Screenshots von Kopf, Verlauf mit Band, Vergleich, „je Monat“, Liste und Rekorden.
- Artifact „Spiegel-Labor“ unter derselben Adresse neu veröffentlichen (direkter Build), dem User öffnen.
- Datenlage abgleichen (conventions §9): Die Saison muss die Zustände hergeben, die geprüft werden:
  - Formknick, Munitionswechsel;
  - Vergleich mit Urteil und ohne;
  - über 60 Scheiben;
  - eine Scheibe nur aus Probe;
  - `nur-pdf`.

  Was sie nicht hergibt, steht im Bericht als „nicht belegt“.
