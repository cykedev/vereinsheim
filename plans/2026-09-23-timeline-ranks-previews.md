# Schussverteilung je Einheit · geteilte Plätze · Wettbewerbsliste mit Tabellen

**Datum:** 2026-09-23 · **Branch:** `feat/timeline-ranks-previews` · **Apps:** treffsicher, ringwerk

## 1. Context (warum)

Drei Rückmeldungen des Users, ein Branch:

1. **Treffsicher — „Schussverteilung im Zeitverlauf" bündelt zeitlich.** Bei vielen Einheiten
   werden die Punkte zu Tagen, Wochen oder Monaten zusammengefasst. Gewünscht: **jede Einheit ein
   Punkt**, damit Veränderungen sichtbar werden.
2. **Ringwerk — die Seite „Wettbewerbe" ist wenig nützlich.** Gewünscht: die Wettbewerbe wie im
   Dashboard zeigen (mit Tabellen-Vorschau), **plus** die Navigation und Aktionen der heutigen
   Listenkarten.
3. **Ringwerk — Gleichstände bekommen verschiedene Plätze.** Hat z.B. noch niemand geschossen,
   stehen alle gleich und werden nach Namen durchnummeriert (1, 2, 3, …). Gewünscht: **Sortierung
   nach Namen bleibt, aber alle tragen denselben Platz** (z.B. alle 1).

### Ist-Stand (erhoben über den Code)

| Stelle | Verhalten heute |
| --- | --- |
| `treffsicher/…/hooks/useAggregatedShotDistribution.ts` + `utils/shotDistribution.ts` | fasst Einheiten zusammen: ≤ 45 Einheiten oder ≤ 140 Tage → **je Tag**, bis 500 Tage → **je Woche**, darüber → **je Monat**, gewichtet nach Schusszahl. Auch „je Tag" legt zwei Einheiten am selben Tag zusammen. Die Tagesgrenze kommt aus `setHours(0,0,0,0)`, also der Zeitzone des Browsers. |
| `ringwerk/src/app/(app)/page.tsx` (Dashboard) | lädt je **aktivem** Wettbewerb Tabelle / Bracket / Rangliste (≈ 130 Zeilen im Seitencode) und zeigt sie in `DashboardCompetitionCard` (Vorschau 6 Zeilen, „+ N weitere anzeigen") |
| `ringwerk/src/app/(app)/competitions/page.tsx` + `CompetitionListCard.tsx` | kompakte Karten: Name, Badges, Navigationslinks, Termine, `CompetitionActions`. **Keine** Ergebnisse. Abgeschlossene mit `opacity-70`, Archivierte mit `opacity-50`. |
| `lib/standings/calculateStandings.ts` (Liga) | `rank = i + 1` nach `sortWithDirectComparison`: Punkte → Direktpunkte → bester Wert → Nachname |
| `lib/standings/calculateBestOfStandings.ts` (Best-of) | `rank = i + 1` nach `sortStandings`: Siege → Satzdiff. → gewonnene Sätze → Direktbilanz → Nachname |
| `lib/scoring/rankParticipants.ts` (Event, Team-Event) | `rank = index + 1` nach Score; bei gleichem Score bleibt die **Eingangsreihenfolge**, nicht der Name |
| Saison (`SeasonStandingsTable.tsx`, `SeasonStandingsPdf.tsx`) | Platz = `idx + 1` in der Anzeigereihenfolge. Die **Metrik-Ränge** (`bestRings_rank` …) teilen Gleichstände schon heute (`assignRanks` in `calculateSeasonStandings.ts`) |
| `lib/playoffs/actions/match.ts` | Re-Seeding der Playoffs liest `standings[].rank` |

## 2. Entscheidungen

**E1 (User, 2026-09-23): Vorschau für „Aktiv" und „Abgeschlossen".** Entwürfe haben keine Ergebnisse.
Archivierte bleiben kompakte Karten wie heute. Navigation und Aktionen bekommen alle Karten.

**E2 (User, 2026-09-23): Podiumsfarben nur mit Ergebnis.** Die Platznummer wird geteilt, aber
Gold/Silber/Bronze (Badge und Zeilenhintergrund) bekommt nur eine Zeile mit mindestens einem
Ergebnis. Sonst wäre vor dem ersten Schuss die ganze Tabelle gold. Ergebnis heißt: Liga
`played + byes > 0`, Best-of `played > 0`, Saison `seriesCount > 0`. Beim Event hat jeder Eintrag
eine Serie, also immer ein Ergebnis.

**E3: Was als Gleichstand gilt.** Zwei Zeilen teilen sich den Platz genau dann, wenn **jedes
Wertungskriterium** gleich ist und nur noch der Name sie ordnet. Echte Tiebreaks bleiben
Tiebreaks: ein entschiedener Direktvergleich, ein besserer Bestwert in der Liga oder der
Ringteiler in der Saison trennen weiter. Das ist die kleinste Änderung, die die Bitte erfüllt,
und ändert keine Sportleiter-Entscheidung (siehe `best-of-standings-direct-comparison-tiebreak`).

**E4: Zählweise „1, 1, 3".** Das ist die übliche Wettkampf-Rangfolge: nach zwei geteilten
Ersten folgt Platz 3. `assignRanks` in `calculateSeasonStandings.ts` zählt die Metrik-Ränge schon
heute so. Die Alternative „1, 1, 2" verworfen, weil zwei Zählweisen in derselben Saison-Tabelle
stünden.

**E5: Das Event bekommt dieselbe Regel.** Gleicher Score heißt gleicher Platz, sortiert nach
Nachname, dann Vorname. Teams sortieren nach Teamnummer. Heute entscheidet dort die
Eingangsreihenfolge, und die ist weder nachvollziehbar noch gewollt.

**E6: Die Playoff-Setzung liest die Tabellenposition, nicht den Platz.** `match.ts` bildet die
Setzliste aus der Reihenfolge (`i + 1`). Das Verhalten bleibt damit bitgleich zu heute, auch bei
geteiltem Platz. Die Erstrunden-Setzung (`createFirstRoundMatchups`) nutzt schon heute die
Reihenfolge.

**E7: Saison in alternierender Sortierung.** Dort vergibt die Folge jeden Platz einzeln, abwechselnd
nach Ringen und Teiler. Eine geteilte Nummer ergibt dort keinen Sinn. Geteilt wird nur im Block
„ohne Serie" am Ende, der rein alphabetisch ist.

**E8: Das Dashboard bleibt optisch unverändert.** Es teilt ab jetzt Loader und Vorschau-Tabelle
mit der Wettbewerbsliste. Verworfen: eine Karte mit Varianten-Flag. Die Listenkarte bekommt
stattdessen eine optionale `preview` und bleibt die eine Listenkarte.

**E9: Treffsicher-Achse.** Beschriftung `formatShortDate` („08.09.26"), wie im Ergebnisverlauf,
weil Einheiten über Jahre reichen können. Tooltip: `formatDateTime` + Schusszahl, damit zwei
Einheiten am selben Tag unterscheidbar sind. Nur das Band 0–6 bleibt gebündelt, das ist eine
Ring-Bündelung und keine zeitliche.

## 3. Approach

### 3.1 Treffsicher: ein Punkt je Einheit

Neue reine Funktion in `apps/treffsicher/src/components/app/statistics-charts/utils/shotDistribution.ts`.
Sie **ersetzt** `getShotDistributionGranularity` und `getShotDistributionBucketStart`:

```ts
import { formatDateTime, formatShortDate } from "@vereinsheim/lib/format"
import type { ShotDistributionPoint } from "@/lib/stats/actions"
import type { ShotDistributionTimelinePoint } from "@/components/app/statistics-charts/types"

const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Ein Punkt je Einheit, chronologisch — bewusst ohne zeitliche Bündelung, damit Veränderungen
 * von Einheit zu Einheit sichtbar bleiben. Gebündelt wird nur der Ringbereich 0–6.
 */
export function buildShotDistributionTimeline(
  points: ShotDistributionPoint[],
  displayTimeZone: string
): ShotDistributionTimelinePoint[] {
  return points
    .filter((point) => point.totalShots > 0)
    .map((point) => ({ point, date: new Date(point.date) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ point, date }, index) => {
      const r7 = round1(point.r7)
      const r8 = round1(point.r8)
      const r9 = round1(point.r9)
      const r10 = round1(point.r10)
      return {
        i: index,
        sessionId: point.sessionId,
        date,
        dateLabel: formatShortDate(date, displayTimeZone),
        tooltipLabel: `${formatDateTime(date, displayTimeZone)} · ${point.totalShots} Schuss`,
        totalShots: point.totalShots,
        // Rest auf 100 %, damit der Stapel trotz Rundung genau voll ist (wie bisher).
        r0to6: round1(Math.max(0, 100 - r7 - r8 - r9 - r10)),
        r7,
        r8,
        r9,
        r10,
      }
    })
}
```

In `types.ts` wird `AggregatedShotDistributionPoint` zu `ShotDistributionTimelinePoint`, plus Feld
`sessionId: string`. `ShotDistributionGranularity` entfällt. Der Hook wird zu
`useShotDistributionTimeline` (nur noch `useMemo` um die Funktion). Das Modellfeld
`aggregatedShotDistribution` heißt überall `shotDistributionTimeline`. „aggregiert" wäre sonst
eine falsche Aussage im Code. `tsc` findet jede Stelle.

Karte (`ShotDistributionTimelineCard.tsx`): Untertitel
`Anteil je Ringwert in % · je Einheit, 0–6 gebündelt`. Sonst bleibt alles gleich: Ticks über
`buildIndexTicks`, Tooltip und Legende.

### 3.2 Ringwerk: geteilte Plätze

**Kern**: neue reine Datei `apps/ringwerk/src/lib/scoring/sharedRanks.ts`:

```ts
/**
 * Wettkampf-Rangfolge „1, 1, 3" über eine bereits sortierte Liste: benachbarte Zeilen, die sich in
 * allen Wertungskriterien gleichen (und nur noch alphabetisch geordnet sind), teilen sich den Platz;
 * der nächste Platz zählt die geteilten mit. Gleichstände liegen nach dem Sortieren nebeneinander,
 * deshalb genügt der Vergleich mit dem Vorgänger.
 */
export function assignSharedRanks<T>(
  sorted: readonly T[],
  isTied: (a: T, b: T) => boolean
): number[] {
  const ranks: number[] = []
  sorted.forEach((row, i) => {
    ranks.push(i > 0 && isTied(sorted[i - 1], row) ? ranks[i - 1] : i + 1)
  })
  return ranks
}
```

**Liga (DOUBLE_ROUND_ROBIN)**, `lib/standings/standingsSort.ts`:

- `sortWithDirectComparison` sammelt die Direktpunkte aller Gruppen in einer Map. Sie ist heute
  lokal pro Gruppe. Nach dem Sortieren vergibt die Funktion `rank`. Der Docstring sagt das
  („sortiert und vergibt die Plätze").
- Letztes Kriterium: `a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de")`.
- Gleichstand: gleiche `points` **und** gleiche Direktpunkte **und** gleicher Bestwert. Der Bestwert
  ist `bestRings` bei `RINGS`/`RINGS_DECIMAL`, sonst `bestRingteiler`. `null === null` zählt als
  gleich. Der Helfer `tieValue` spiegelt genau den Sortierzweig.
- Neu exportiert: `export function hasLeagueResult(row: Pick<StandingRow, "played" | "byes">): boolean { return row.played + row.byes > 0 }`
- `calculateStandings.ts`: `sorted.forEach((r, i) => { r.rank = i + 1 })` entfällt. Zurückgezogene
  bleiben bei `sorted.length + 1`.

**Best-of**, `lib/standings/bestOfStandingsSort.ts`:

- `resolveTieGroup` gibt seine Bilanz-Map zurück (`Map<participantId, number>`). `sortStandings`
  sammelt sie. Einzelgruppen bekommen Bilanz 0, das ist irrelevant, weil sich dort das Tripel
  unterscheidet.
- Am Ende von `sortStandings` wird `rank` vergeben. Gleichstand heißt gleiches `wins`, `duelDiff`,
  `duelsWon` **und** gleiche Direktbilanz. Ein offener 2er-Gleichstand (0/0) teilt also den Platz,
  ein entschiedener (+1/−1) nicht. Ein zyklischer 3er (alle 0) teilt, eine gespaltene Gruppe
  (+1, +1, −1, −1) wird zu 1, 1, 3, 3.
- Letztes Kriterium: Nachname, dann Vorname (wie Liga).
- Neu exportiert: `export function hasBestOfResult(row: Pick<BestOfStandingRow, "played">): boolean { return row.played > 0 }`
- `calculateBestOfStandings.ts`: `sorted.forEach((r, i) => { r.rank = i + 1 })` entfällt.
- Die Spalte „Direktvergleich" („offen"/„ausgeglichen") bleibt unverändert. Sie erklärt jetzt
  zusätzlich, **warum** zwei Zeilen denselben Platz haben.

**Event**, `lib/scoring/rankParticipants.ts` + `rankEventParticipants.ts`:

```ts
/** Scores gelten unterhalb dieser Differenz als gleich (Summen von Nachkommaresten sind Floats). */
const SCORE_EPSILON = 1e-9

export function rankByScore(entries: RankableEntry[], mode: ScoringMode): RankedEntry[] {
  const direction = SCORE_DIRECTION[mode]
  const sorted = [...entries].sort((a, b) => {
    const diff = direction === "asc" ? a.score - b.score : b.score - a.score
    return Math.abs(diff) < SCORE_EPSILON ? 0 : diff
  })
  // Bei gleichem Score bleibt die eingehende Ordnung stehen (Array#sort ist stabil) — der
  // Aufrufer sortiert vorher nach Namen bzw. Teamnummer.
  const ranks = assignSharedRanks(sorted, (a, b) => Math.abs(a.score - b.score) < SCORE_EPSILON)
  return sorted.map((entry, index) => ({ ...entry, rank: ranks[index] }))
}
```

- `rankEventParticipants`: die `series` vor dem Mapping nach `participant.lastName`, dann
  `participant.firstName` sortieren (`localeCompare(…, "de")`) — auf einer Kopie.
- `rankEventTeams`: `teamEntries` vor `rankByScore` nach `teamNumber` aufsteigend sortieren.

**Saison**, `lib/scoring/sortSeasonStandings.ts`:

- `sortClassic`: Bei gleichem Wert der Metrik gilt **explizit** `bestRingteiler` aufsteigend,
  `null` zuletzt, danach `byName`. Heute entscheidet die eingehende Ordnung, die genau das ist,
  außer bei exakt gleichem Ringteiler. Den Kommentar dazu anpassen.
- Neu:

```ts
/** Eine Zeile mit mindestens einer Serie — nur sie trägt Podiumsfarben. */
export const hasSeasonResult = (e: Pick<SeasonStandingsEntry, "seriesCount">): boolean =>
  e.seriesCount > 0

/**
 * Platz je Zeile der Anzeigereihenfolge — die einzige Quelle für Tabelle, PDF und Dashboard.
 * Klassisch teilen Zeilen den Platz, die im Block, in der Metrik UND im Ringteiler gleich sind
 * (also nur noch alphabetisch geordnet). Alternierend vergibt die Folge jeden Platz einzeln;
 * geteilt wird nur im Block ohne Serie.
 */
export function seasonPositions(
  sorted: readonly SortedSeasonStandingsEntry[],
  sort: ResolvedSeasonSort
): number[] {
  if (isAlternatingSort(sort)) {
    return assignSharedRanks(sorted, (a, b) => !hasSeasonResult(a) && !hasSeasonResult(b))
  }
  const value = (e: SeasonStandingsEntry) =>
    sort === "rings" ? e.bestRings : sort === "teiler" ? e.bestCorrectedTeiler : e.bestRingteiler
  return assignSharedRanks(
    sorted,
    (a, b) =>
      a.meetsMinSeries === b.meetsMinSeries &&
      value(a) === value(b) &&
      a.bestRingteiler === b.bestRingteiler
  )
}
```

**Anzeige** (Podiumsregel E2, ein Prädikat für Bildschirm und PDF):

- `components/ui/rank-badge.tsx`: neue optionale Prop
  `podium?: boolean` (Default `true`). Bei `false` gibt es für jeden Platz den neutralen Stil
  `bg-muted text-muted-foreground`.
- `StandingsTable.tsx`: `<RankBadge rank={row.rank} podium={hasLeagueResult(row)} />`; Zeilen-Highlight
  nur `hasLeagueResult(row) ? ROW_HIGHLIGHT[row.rank] : ""`.
- `BestOfStandingsTable.tsx`: dasselbe mit `hasBestOfResult`.
- `SeasonStandingsTable.tsx`: `const positions = seasonPositions(sorted, alternating ? sort : sortCol)`
  → `<RankBadge rank={positions[idx]} podium={hasSeasonResult(entry)} />`.
- `lib/pdf/SchedulePdf.tsx`: `rankBadgeColor(hasLeagueResult(row) ? row.rank : 0)`. 0 fällt auf das
  heutige Grau.
- `lib/pdf/BestOfSchedulePdf.tsx`: dasselbe mit `hasBestOfResult`.
- `lib/pdf/SeasonStandingsPdf.tsx`: `const positions = seasonPositions(entries, sort)` einmal vor dem
  `map`. Beide Zeilenvarianten (mit/ohne Serienspalte) nutzen `positions[idx]` und
  `rankBadgeColor(hasSeasonResult(entry) ? positions[idx] : 0)`.
- `EventRankingTable`, `EventTeamRankingTable`, `EventRankingPdf` zeigen `entry.rank` und bekommen
  die geteilten Plätze automatisch. Ein Event-Eintrag hat immer ein Ergebnis.

**Playoffs**, `lib/playoffs/actions/match.ts` (E6):

```ts
// Setzung nach Tabellenposition, nicht nach (ggf. geteiltem) Platz — sonst wäre sie bei
// Gleichstand nicht eindeutig.
const rankMap = new Map(standings.map((s, i) => [s.participantId, i + 1]))
```

### 3.3 Ringwerk: Wettbewerbsliste mit Tabellen-Vorschau

**Reines Modell**, neu `apps/ringwerk/src/lib/competitions/previewModel.ts` (ohne DB, testbar):

```ts
import type { CompetitionListItem } from "@/lib/competitions/types"
import type { StandingRow, BestOfStandingRow } from "@/lib/standings/standingsTypes" // bzw. bestOfStandingsTypes
import type { PlayoffBracketData } from "@/lib/playoffs/types"
import type { EventRankedEntry, EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import type { ResolvedSeasonSort, SortedSeasonStandingsEntry } from "@/lib/scoring/sortSeasonStandings"

/** Vorschau-Länge der Tabellen in Karten; der Rest steht auf der Detailseite. */
export const PREVIEW_ROWS = 6

export type CompetitionPreview =
  | { kind: "league"; competition: CompetitionListItem; href: string; isBestOf: boolean
      playoffsStarted: boolean; standings: StandingRow[]; bestOfStandings: BestOfStandingRow[]
      bracket: PlayoffBracketData }
  | { kind: "event"; competition: CompetitionListItem; href: string; isTeamEvent: boolean
      ranked: EventRankedEntry[]; teamRanked: EventTeamRankedEntry[] }
  | { kind: "season"; competition: CompetitionListItem; href: string
      standings: SortedSeasonStandingsEntry[]; minSeries: number | null; sort: ResolvedSeasonSort }

export function previewRowCount(p: CompetitionPreview): number
//   league: isBestOf ? bestOfStandings.length : standings.length; event: isTeamEvent ? teamRanked.length : ranked.length; season: standings.length
export function previewMoreCount(p: CompetitionPreview): number | undefined
//   undefined bei league && playoffsStarted (Bracket statt Tabelle), sonst Math.max(0, previewRowCount(p) - PREVIEW_ROWS)
export function previewIsEmpty(p: CompetitionPreview): boolean
//   league: !playoffsStarted && previewRowCount(p) === 0; sonst previewRowCount(p) === 0
export function previewEmptyText(p: CompetitionPreview): string
//   season: "Noch keine Serien erfasst"; sonst "Noch keine Ergebnisse erfasst"
```

Die genauen Importpfade der Standings-Typen übernimmt der Implementer aus `lib/standings/queries.ts`
(re-exportiert `StandingRow`, `BestOfStandingRow`). `playoffsStarted` und die `href`-Regel kommen
1:1 aus dem heutigen Dashboard: Liga → `…/playoffs` nach Playoff-Start, sonst `…/schedule`;
Event → `…/ranking`; Saison → `…/standings`.

**Loader**, neu `apps/ringwerk/src/lib/competitions/preview.ts`:
`export async function loadCompetitionPreview(c: CompetitionListItem): Promise<CompetitionPreview>`.
Das ist der Inhalt der drei `Promise.all`-Zweige aus `app/(app)/page.tsx`, **unverändert
verschoben**, als `switch (c.type)`.

**Darstellung**, neu `apps/ringwerk/src/components/app/competitions/CompetitionPreview.tsx`:

- `CompetitionPreviewBadges({ preview })` — „Playoffs"-Badge (Liga nach Start, mit `Trophy`) bzw.
  „Teams"-Badge (Team-Event). JSX 1:1 aus dem Dashboard.
- `CompetitionPreviewSection({ preview })` — leer → eine Zeile `previewEmptyText`; sonst die Tabelle
  (`PlayoffBracket compact` / `BestOfStandingsTable` / `StandingsTable` / `EventTeamRankingTable` /
  `EventRankingTable` / `SeasonStandingsTable`, je `slice(0, PREVIEW_ROWS)`, JSX 1:1 aus dem
  Dashboard). Darunter „+ N weitere anzeigen" mit Link auf `preview.href`. Die Logik aus
  `DashboardCompetitionCard` zieht hierher.

**Dashboard** (`app/(app)/page.tsx`): die Reihenfolge bleibt Liga, Event, Saison:

```ts
const TYPE_ORDER = ["LEAGUE", "EVENT", "SEASON"] as const
const active = competitions.filter((c) => c.status === "ACTIVE")
const previews = await Promise.all(
  TYPE_ORDER.flatMap((t) => active.filter((c) => c.type === t)).map(loadCompetitionPreview)
)
// … previews.map((p) => <DashboardCompetitionCard key={p.competition.id} preview={p} />)
```

`DashboardCompetitionCard` nimmt nur noch `{ preview }`. Kopf: Name-Link auf `preview.href`,
Disziplin-Badge und `CompetitionPreviewBadges`. Inhalt: `CompetitionPreviewSection`. Optisch ist
das identisch zu heute.

**Listenkarte** (`CompetitionListCard.tsx`): neue optionale Prop `preview?: CompetitionPreview`.

- Kopfzeile: `CompetitionPreviewBadges` kommt hinter das Disziplin-Badge, falls `preview` gesetzt ist.
- Zwischen Termine (`CardMeta`) und Aktionsleiste: `{preview && <CompetitionPreviewSection preview={preview} />}`.
- Name-Link (kanonisch `/competitions/[id]`), Navigationslinks und `CompetitionActions` bleiben.

**Wettbewerbe-Seite** (`app/(app)/competitions/page.tsx`):

```ts
const previews = new Map(
  (await Promise.all([...active, ...completed].map(loadCompetitionPreview))).map((p) => [
    p.competition.id,
    p,
  ])
)
```

- Aktive und abgeschlossene Karten bekommen `preview={previews.get(c.id)}`. Entwurf und Archiv
  bekommen keine Vorschau.
- Der Abschnitt „Abgeschlossen" verliert `opacity-70` und bekommt `space-y-3` statt `space-y-2`.
  Grund: Tabellen hinter Opazität unterschreiten die Kontrast-Untergrenze aus conventions §3.
  Die Überschrift mit `CheckCircle` bleibt die Trennung. Das Archiv bleibt `opacity-50`, dort
  stehen kompakte Karten ohne Tabelle.

## 4. Dateien

| Datei | Änderung |
| --- | --- |
| `apps/treffsicher/src/components/app/statistics-charts/utils/shotDistribution.ts` | Granularität/Bucket raus, `buildShotDistributionTimeline` rein |
| `…/statistics-charts/utils/shotDistribution.test.ts` | **neu** |
| `…/statistics-charts/utils/index.ts` | Export anpassen |
| `…/statistics-charts/hooks/useAggregatedShotDistribution.ts` → `useShotDistributionTimeline.ts` | `git mv` + auf die reine Funktion reduzieren |
| `…/statistics-charts/hooks/index.ts` | Export anpassen |
| `…/statistics-charts/types.ts` | Typ umbenennen + `sessionId`, `ShotDistributionGranularity` raus |
| `…/hooks/{useStatisticsChartData,useStatisticsChartPresentationState,useStatisticsChartsModel,useStatisticsTabsModel}.ts`, `…/hooks/ui-models/types.ts`, `…/tabs/types.ts`, `…/tabs/QualityTab.tsx` | Feld `aggregatedShotDistribution` → `shotDistributionTimeline` |
| `…/tabs/quality/ShotDistributionTimelineCard.tsx` | Feldname + Untertitel |
| `apps/ringwerk/src/lib/scoring/sharedRanks.ts` (+ `.test.ts`) | **neu** |
| `apps/ringwerk/src/lib/standings/standingsSort.ts`, `calculateStandings.ts` (+ Tests) | geteilte Plätze Liga, `hasLeagueResult` |
| `apps/ringwerk/src/lib/standings/bestOfStandingsSort.ts`, `calculateBestOfStandings.ts` (+ Tests) | geteilte Plätze Best-of, `hasBestOfResult` |
| `apps/ringwerk/src/lib/scoring/rankParticipants.ts`, `rankEventParticipants.ts` (+ Tests) | geteilte Plätze Event, Namens-/Teamnummer-Vorsortierung |
| `apps/ringwerk/src/lib/scoring/sortSeasonStandings.ts` (+ Test) | expliziter Tiebreak, `seasonPositions`, `hasSeasonResult` |
| `apps/ringwerk/src/components/ui/rank-badge.tsx` | Prop `podium` |
| `apps/ringwerk/src/components/app/standings/{StandingsTable,BestOfStandingsTable}.tsx` | Podiumsregel |
| `apps/ringwerk/src/components/app/series/SeasonStandingsTable.tsx` (+ `.test.tsx`) | `seasonPositions` + Podiumsregel |
| `apps/ringwerk/src/lib/pdf/{SchedulePdf,BestOfSchedulePdf,SeasonStandingsPdf}.tsx` | Podiumsregel, Saison-Positionen |
| `apps/ringwerk/src/lib/playoffs/actions/match.ts` | Setzliste aus Position |
| `apps/ringwerk/src/lib/competitions/previewModel.ts` (+ `.test.ts`), `preview.ts` | **neu** |
| `apps/ringwerk/src/components/app/competitions/CompetitionPreview.tsx` | **neu** |
| `apps/ringwerk/src/components/app/dashboard/DashboardCompetitionCard.tsx` | Prop `preview` |
| `apps/ringwerk/src/app/(app)/page.tsx` | Loader + Karten |
| `apps/ringwerk/src/components/app/competitions/CompetitionListCard.tsx` | optionale `preview` |
| `apps/ringwerk/src/app/(app)/competitions/page.tsx` | Previews laden, Opazität |
| `vault/apps/treffsicher/treffsicher-requirements.md`, `vault/apps/ringwerk/ringwerk-features.md`, `vault/apps/ringwerk/season-mode.md` | Doku |

Kein Schema, keine Migration, kein Deploy-Vertrag, nichts unter `.claude/`, `scripts/` oder
`vault/decisions/`.

## Required Docs

- `vault/conventions.md` — §2 (Leerzustände), §3 (Kontrast, Typografie), §4 (Farb-Tokens, Icons),
  §6 (Formatierung nur über `@vereinsheim/lib/format`), §7 (Name-als-Link bei Wettbewerben),
  §9 (ein Prädikat für Bildschirm + PDF; Markup-Tests ohne jsdom)
- `apps/ringwerk/CLAUDE.md`, `apps/treffsicher/CLAUDE.md`
- Vault: `ringwerk-features` (Abschnitte „Tabelle & Rangliste", „Tabelle" beim Best-of,
  „Dashboard-Aufteilung", „Wettbewerbs-Listenansicht"), `season-mode`,
  `best-of-standings-direct-comparison-tiebreak`, `league-points-and-tiebreak`,
  `treffsicher-requirements` (Abschnitt Statistiken)

## 5. Tasks (je ein Commit, `pnpm check` grün vor jedem Commit)

**T1 — Treffsicher: reine Timeline-Funktion + Test.**
`buildShotDistributionTimeline` + Typ `ShotDistributionTimelinePoint` (mit `sessionId`) wie in §3.1.
Die alten Funktionen und `ShotDistributionGranularity` löschen. Der Hook (noch unter altem Namen)
ruft nur noch die neue Funktion. Die Typ-Umbenennung gilt **inklusive aller Type-Importe**
(`tabs/types.ts`, `hooks/ui-models/types.ts`, `useStatisticsChartPresentationState.ts`), sonst ist
`tsc` rot. Die Feld-Umbenennung kommt erst in T2.
Test `utils/shotDistribution.test.ts` (Zeitzone `"Europe/Berlin"`):
- zwei Einheiten am **selben Tag** → **zwei** Punkte, Werte je Einheit unverändert (keine Mittelung)
- unsortierte Eingabe → aufsteigend nach Datum, `i` = 0, 1, 2
- `totalShots: 0` fällt raus
- `r7 = 10.2, r8 = 20.1, r9 = 30.3, r10 = 25.1` → `r0to6 = 14.3`
- `date = 2026-09-08T22:30:00Z`, `totalShots = 40` → `dateLabel = "09.09.26"`,
  `tooltipLabel = "09.09.2026, 00:30 · 40 Schuss"`

Commit: `feat(treffsicher): plot shot distribution per session instead of per time bucket`

**T2 — Treffsicher: Umbenennung + Karte.** `git mv` des Hooks zu `useShotDistributionTimeline.ts`.
Das Feld heißt überall `shotDistributionTimeline`, der Kartentitel-Untertitel wie §3.1.
Commit: `refactor(treffsicher): name the shot distribution timeline for what it is`

**T3 — Ringwerk: `assignSharedRanks` + Test.** `sharedRanks.test.ts`:
- leer → `[]`
- ohne Gleichstand → `[1, 2, 3]`
- `[10, 8, 8, 5]` mit `isTied = gleicher Wert` → `[1, 2, 2, 4]`
- alle gleich → `[1, 1, 1]`

Commit: `feat(ringwerk): add a shared competition-ranking helper`

**T4 — Ringwerk: `RankBadge` mit `podium`.** Prop wie §3.2, Default `true` (kein Aufrufer ändert
sich in diesem Task). Commit: `feat(ringwerk): let a rank badge render without podium colour`

**T5 — Liga: geteilte Plätze + Podiumsregel + Setzung.** `standingsSort.ts`, `calculateStandings.ts`,
`StandingsTable.tsx`, `SchedulePdf.tsx`, `playoffs/actions/match.ts` wie §3.2.
Tests in `calculateStandings.test.ts`:
- keine Paarung gespielt, Teilnehmer „Zeta", „Alpha", „Mitte" → Reihenfolge Alpha, Mitte, Zeta;
  Plätze `1, 1, 1`
- A schlägt B, C und D ohne Duell → A `1`, B `2`, C/D `3, 3` (alphabetisch)
- zwei Teilnehmer mit gleichem Nachnamen → Vorname entscheidet die Reihenfolge, Platz geteilt
- bestehender Test „direkter Vergleich entscheidet bei Punktgleichstand" bleibt `1, 2`
- `hasLeagueResult`: `{played: 0, byes: 0}` → false, `{played: 0, byes: 1}` → true

Commit: `feat(ringwerk): share the league place when only the name separates rows`

**T6 — Best-of: geteilte Plätze + Podiumsregel.** `bestOfStandingsSort.ts`, `calculateBestOfStandings.ts`,
`BestOfStandingsTable.tsx`, `BestOfSchedulePdf.tsx` wie §3.2.
Tests:
- `calculateBestOfStandings.test.ts`, Block „alphabetical order … because the direct comparison is
  open": Erwartung wird `A.rank = 1`, `B.rank = 1` (Reihenfolge Alpha vor Beta bleibt). Den
  Testnamen passend umformulieren.
- `bestOfStandingsSort.test.ts` (mit dem vorhandenen Row-Factory):
  - drei Zeilen ohne Begegnung (alles 0, leeres `headToHead`) → alphabetisch, Plätze `1, 1, 1`
  - 2er-Gleichstand mit gespieltem Direktvergleich → `1, 2`
  - 4er-Gleichstand auf dem Tripel mit Direktbilanzen +1, +1, −1, −1 → `1, 1, 3, 3`
- `hasBestOfResult`: `played: 0` → false, `played: 1` → true

Commit: `feat(ringwerk): share the best-of place when the direct comparison cannot decide`

**T7 — Event: geteilte Plätze.** `rankParticipants.ts`, `rankEventParticipants.ts` wie §3.2.
Tests:
- `rankParticipants.test.ts`: RINGS `[97, 95, 95, 90]` → Plätze `1, 2, 2, 4`; bei Gleichstand bleibt
  die Eingangsreihenfolge; DECIMAL_REST mit `0.1 + 0.2` gegen `0.3` → gleicher Platz
- `rankEventParticipants.test.ts`: zwei Serien mit gleichen Ringen (RINGS), Nachnamen „Zimmer" und
  „Adler" in dieser Eingangsreihenfolge → Adler vor Zimmer, beide gleicher Platz
- `rankEventTeams`: Team 2 und Team 1 mit gleichem Teamscore → Team 1 vor Team 2, gleicher Platz

Commit: `feat(ringwerk): share the event place on equal scores, ordered by name`

**T8 — Saison: Positionen + Podiumsregel.** `sortSeasonStandings.ts`, `SeasonStandingsTable.tsx`,
`SeasonStandingsPdf.tsx` wie §3.2.
Tests:
- `sortSeasonStandings.test.ts`:
  - klassisch Ringteiler, Werte `10.0`, `12.5` (Zeta), `12.5` (Alpha) → Reihenfolge 10.0, Alpha, Zeta;
    Positionen `1, 2, 2`
  - 2 Zeilen mit Serien + 3 ohne → `1, 2, 3, 3, 3`
  - niemand hat eine Serie → alle `1`
  - klassisch Ringe: gleiche Ringe, verschiedener Ringteiler → verschiedene Positionen
  - alternierend: Zeilen mit Serien fortlaufend, Block ohne Serie teilt eine Position
  - `hasSeasonResult`: `seriesCount 0` → false, `1` → true
- `SeasonStandingsTable.test.tsx` (`renderToStaticMarkup`): zwei Teilnehmer ohne Serie → beide
  Zeilen zeigen `1`, und das Markup enthält **kein** `bg-rank-1/20` (neutraler Badge)

Commit: `feat(ringwerk): share the season place for rows only the name separates`

**T9 — Vorschau-Modell, Loader, Dashboard (verhaltensneutral).** `previewModel.ts` (+ Test),
`preview.ts`, `CompetitionPreview.tsx`, `DashboardCompetitionCard.tsx`, `app/(app)/page.tsx`
wie §3.3.
Test `previewModel.test.ts` (Fixtures als minimale Objekte mit `as` auf die Typen):
- Liga mit Playoff-Start → `previewMoreCount` = `undefined`, `previewIsEmpty` = false (auch bei 0 Zeilen)
- Liga ohne Playoffs mit 8 Zeilen → `previewMoreCount` = 2
- Event mit Teams → zählt `teamRanked`, nicht `ranked`
- Saison ohne Zeilen → `previewIsEmpty` = true, `previewEmptyText` = „Noch keine Serien erfasst"

Commit: `refactor(ringwerk): share the competition preview between dashboard and list`

**T10 — Wettbewerbe-Seite mit Vorschau.** `CompetitionListCard.tsx`, `competitions/page.tsx` wie §3.3.
Commit: `feat(ringwerk): show standings previews on the competitions page`

**T11 — Doku (Vault).**
- `treffsicher-requirements.md`, Punkt „Schussverteilung im Zeitverlauf": „ein Punkt je Einheit,
  keine zeitliche Bündelung (seit September 2026); nur 0–6 als ein Band; Tooltip mit Datum,
  Uhrzeit und Schusszahl".
- `ringwerk-features.md`:
  - Abschnitt „Tabelle & Rangliste" (Liga) und Best-of-„Tabelle", Kriterium 5: „Nachname, Vorname
    alphabetisch — Zeilen, die erst hier getrennt werden, **teilen sich den Platz** (1, 1, 3)."
  - Absatz zur Podiumsregel E2.
  - Event-„Rangliste": gleicher Score → gleicher Platz, nach Name.
  - „Wettbewerbs-Listenansicht" neu fassen: aktive und abgeschlossene Karten mit
    Tabellen-Vorschau (geteilt mit dem Dashboard über `loadCompetitionPreview`), Navigation und
    Aktionen; Entwurf und Archiv kompakt.
- `season-mode.md`: `seasonPositions` als einzige Quelle der Platznummer; Regeln klassisch und
  alternierend (E7).
- Danach `node .claude/vault-lint.mjs` (bzw. `/sync-graph`) grün.

Commit: `docs(vault): record shared places, the competitions preview and the per-session timeline`

## 6. Verification

1. `pnpm check` (lint, format:check, test, tsc, next build) — beide Apps grün.
2. `bash scripts/consistency-check.sh` — grün. Keine Palette-Klassen, kein inline `Intl`, keine
   Opazität auf `text-muted-foreground`.
3. Browser-Login: Die Dev-DB enthält eine Kopie der Live-Daten. Der User meldet sich **selbst** im
   Browser-Pane als `christian@eiden.ch` an. Claude setzt und tippt keine Passwörter. Danach
   laufen die Prüfungen in dieser Session.
   Browser (`preview_start` „treffsicher"): `/statistics`, Tab mit der Schussverteilung → Anzahl
   der Punkte = Anzahl gefilterter Einheiten mit Einzelschüssen. Tooltip zeigt Datum, Uhrzeit und
   Schusszahl. Zwei Einheiten am selben Tag ergeben zwei Punkte.
4. Browser (`preview_start` „ringwerk"):
   - `/` Dashboard: optisch wie vorher, Karten in der Reihenfolge Liga, Event, Saison
   - `/competitions`: aktive und abgeschlossene Karten mit Tabelle, Navigation, Aktionen;
     „+ N weitere anzeigen" führt auf die Detailseite; Entwurf und Archiv kompakt; Filter
     funktionieren weiter
   - eine Liga ohne gespieltes Duell: alle Zeilen Platz 1, alphabetisch, **ohne** Gold
   - Saison mit Teilnehmern ohne Serie: gemeinsamer Platz, neutral
   - Liga-/Best-of-/Saison-PDF: dieselben Plätze wie die Tabelle
   - Mobil (375 px): Karten mit Tabelle ohne horizontales Scrollen der Seite
5. Playoffs: vorhandene Tests zu `createNextRoundMatchups` bleiben grün. Für aktive Teilnehmer
   ist die Positions-Map identisch mit dem bisherigen `rank` (`i + 1`), die Setzung ändert sich
   also nicht.
