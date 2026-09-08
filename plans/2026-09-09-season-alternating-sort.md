# Saison-Rangliste: alternierende Sortierung (Ringe/Teiler)

**Datum:** 2026-09-09 · **Branch:** `feat/season-alternating-sort` · **App:** ringwerk

## 1. Context (warum)

Für Saison-Wettbewerbe (`type = SEASON`, Jahrespreisschiessen) soll die Rangliste zwei neue
Sortierungen anbieten:

- **„Ringe/Teiler alternierend"** — beste Ringe, bester Teiler, zweitbeste Ringe, zweitbester
  Teiler, …
- **„Teiler/Ringe alternierend"** — bester Teiler, beste Ringe, zweitbester Teiler, …

„Teiler" ist dabei der **korrigierte** Teiler (Teiler × `Discipline.teilerFaktor`), der bei
gemischten Wettbewerben greift — genau der Wert, den die Spalte „Best. Teiler korr." heute schon
zeigt (`bestCorrectedTeiler`, [factor-correction]). Die Reihenfolge muss in **Tabelle und PDF**
identisch sein. Ist eine alternierende Sortierung gewählt, ist **manuelles Sortieren** der Tabelle
sinnlos und wird deaktiviert.

### Ist-Stand (erhoben über CodeGraph)

| Stelle | Verhalten heute |
| --- | --- |
| `src/lib/scoring/calculateSeasonStandings.ts` | berechnet **immer** alle drei Metriken (`bestRings`, `bestCorrectedTeiler`, `bestRingteiler`) + je einen Einzelrang; sortiert am Ende **hart nach `bestRingteiler_rank`** |
| `src/components/app/series/SeasonStandingsTable.tsx` | sortiert clientseitig um: Default via `defaultSortCol(scoringMode)`, danach per Klick auf die drei Spaltenköpfe |
| `src/lib/pdf/SeasonStandingsPdf.tsx` + die zwei PDF-Routen | rendern die Reihenfolge **wie geliefert** → also immer Ringteiler |
| `src/app/(app)/page.tsx` (Dashboard) | `standings.slice(0, PREVIEW_ROWS)` **vor** der Tabelle → die Tabelle sortiert die bereits abgeschnittenen 5 Zeilen um |

Daraus folgen zwei **Bestandsfehler**, die dieser Plan mit erledigt (sie sind derselbe Defekt —
zwei Sortierpfade statt einem):

1. Tabelle und PDF weichen heute voneinander ab, sobald der Wertungsmodus ≠ Ringteiler ist
   (Tabelle nach Ringen/Teiler, PDF nach Ringteiler).
2. Die Dashboard-Karte zeigt die **falschen** Top-5, wenn der Wertungsmodus ≠ Ringteiler ist
   (erst schneiden, dann sortieren).

## 2. Entscheidungen (mit Begründung — revidierbar)

Diese Punkte waren offen; ich habe sie entschieden statt zu blockieren. Wer widerspricht, sagt es
vor der Freigabe — die Umsetzung hängt an ihnen.

**E1 — Datenmodell: neues, eigenes Feld statt neuer `ScoringMode`-Werte.**
Neues Prisma-Enum `SeasonSortMode { ALT_RINGS_FIRST, ALT_TEILER_FIRST }` + nullbares Feld
`Competition.seasonSortMode` (null = klassisch, aus `scoringMode` abgeleitet).
_Grund:_ `ScoringMode` ist in der geteilten Scoring-Engine verdrahtet — `SCORE_DIRECTION` und
`calculateScore` sind **exhaustive** über das Enum, und dieselben Werte tragen Liga-Duelle
(`determineOutcome`), Best-of-Tiebreaker und Playoff-Kriterien (`finalePrimary`,
`groupTiebreaker1/2`). Zwei Werte, die dort **keine** Bedeutung haben, wären ein dauerhafter
Fußangel für ein Saison-Detail. Verworfen: Werte ins `ScoringMode`-Enum aufnehmen.

**E2 — trotzdem nur EIN Dropdown.** Im Saison-Formular bleibt es bei der einen Auswahl
„Wertungsmodus" mit dann 6 Einträgen (4 wie heute + 2 alternierende) — so wie gewünscht. Wählt man
einen alternierenden Eintrag, schreibt das Formular `seasonSortMode = ALT_*` **und**
`scoringMode = RINGTEILER`.
_Grund:_ `scoringMode` steuert bei SEASON nicht nur die Sortierung, sondern über
`getEffectiveScoringType` auch das **Eingabeformat der Ringe** (`RINGS` → ganzzahlig,
`RINGS_DECIMAL` → Zehntel, `RINGTEILER`/`TEILER` → folgt der Disziplin). `RINGTEILER` ist der
neutrale Wert: das Format folgt dann der Disziplin. Das ist die einzige unsichtbare Zuordnung im
Entwurf; sie wird im Formular als Hinweistext benannt.

**E3 — Metriken:** „Ringe" = `bestRings` (Spalte „Beste Ringe"), „Teiler" = `bestCorrectedTeiler`
(Spalte „Best. Teiler [korr.]"). Die Ringteiler-Spalte spielt für die alternierende Reihenfolge
**keine** Rolle, bleibt aber als Information stehen.
_Grund:_ so gelesen aus „das Ringe … bezieht sich auf den korrigierten Teiler" — gemeint ist der
Teiler-Wert, der bei gemischten Wettbewerben faktor-korrigiert ist. **Falls „Teiler" hier den
Ringteiler meinte, ist das eine Ein-Zeilen-Änderung** in `sortSeasonStandings` (Metrik-Zugriff) —
bitte vor der Freigabe sagen.

**E4 — Herkunft sichtbar:** Jede Zeile zeigt, über welche Metrik sie auf ihren Platz kam — der
maßgebliche Wert wird hervorgehoben (`font-medium text-foreground`), die anderen zwei zurückgenommen
(`text-muted-foreground`), plus eine Legendenzeile. In Tabelle **und** PDF gleich.
_Grund:_ eine alternierende Liste ist ohne das nicht nachvollziehbar; gleiche Linie wie die
Direktvergleich-Anmerkung in der Best-of-Tabelle ([best-of-standings-direct-comparison-tiebreak]).
Verworfen: eigene Spalte „Kriterium" — im PDF sind nur 515pt Breite verfügbar, die drei
Metrik-Spalten müssten dafür schrumpfen.

**E5 — eine Sortierfunktion für alle Modi.** Tabelle, Wettbewerbs-PDF, öffentliches PDF und
Dashboard nutzen dieselbe reine Funktion — auch für die drei klassischen Modi. Damit sind die zwei
Bestandsfehler aus §1 erledigt. Verworfen: nur die neuen Modi anfassen (lässt zwei Sortierpfade
stehen und die Abweichung Tabelle/PDF bestehen).

**E6 — Regeln der alternierenden Platzierung** (Details, keine Rückfrage nötig, aber explizit):

- Jeder Teilnehmer erscheint **genau einmal**. Pro Platz wird der beste **noch nicht platzierte**
  Teilnehmer der Metrik dieses Platzes genommen. Wer in beiden Metriken der Beste ist, belegt den
  ersten Platz; der zweite Platz geht dann an den Zweitbesten der anderen Metrik.
- Gleichstand innerhalb einer Metrik → alphabetisch (`localeCompare(…, "de")`), deterministisch.
- **Blöcke** (wie heute): erst die Qualifizierten (`meetsMinSeries`), dann die Nicht-Qualifizierten
  — innerhalb **jedes** Blocks alternierend; Teilnehmer ohne Serie zuletzt, alphabetisch.
- Die drei Einzelränge (`bestRings_rank` usw.) bleiben unverändert und werden weiter angezeigt.

## 3. Approach

### Kern: eine reine Sortierfunktion

Neu: `apps/ringwerk/src/lib/scoring/sortSeasonStandings.ts` — rein, isomorph (nur Type-Imports aus
`@/generated/prisma/client`, also auch in der Client-Komponente nutzbar).

```ts
import type { ScoringMode, SeasonSortMode } from "@/generated/prisma/client"
import type { SeasonStandingsEntry } from "./calculateSeasonStandings"

/** Metrik, die eine Zeile auf ihren Platz gebracht hat — nur in den alternierenden Modi gesetzt. */
export type AlternatingBy = "rings" | "teiler" | null

export type SortedSeasonStandingsEntry = SeasonStandingsEntry & { alternatingBy: AlternatingBy }

/** Aufgelöste Sortierung: eine der drei Spalten oder eine der beiden alternierenden Folgen. */
export type ResolvedSeasonSort = "rings" | "teiler" | "ringteiler" | "alt-rings" | "alt-teiler"

export const SEASON_SORT_LABELS: Record<ResolvedSeasonSort, string> = {
  rings: "Beste Ringe",
  teiler: "Bester Teiler",
  ringteiler: "Bester Ringteiler",
  "alt-rings": "Ringe/Teiler alternierend",
  "alt-teiler": "Teiler/Ringe alternierend",
}

export function resolveSeasonSort(
  scoringMode: ScoringMode,
  seasonSortMode: SeasonSortMode | null
): ResolvedSeasonSort {
  if (seasonSortMode === "ALT_RINGS_FIRST") return "alt-rings"
  if (seasonSortMode === "ALT_TEILER_FIRST") return "alt-teiler"
  if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") return "rings"
  if (scoringMode === "TEILER") return "teiler"
  return "ringteiler"
}

export function isAlternatingSort(sort: ResolvedSeasonSort): boolean {
  return sort === "alt-rings" || sort === "alt-teiler"
}

export function sortSeasonStandings(
  entries: SeasonStandingsEntry[],
  sort: ResolvedSeasonSort
): SortedSeasonStandingsEntry[]
```

Interne Bausteine:

```ts
const byName = (a: SeasonStandingsEntry, b: SeasonStandingsEntry) =>
  a.participantName.localeCompare(b.participantName, "de")

// hat Werte in BEIDEN Metriken — gilt genau für seriesCount > 0
const hasValues = (e: SeasonStandingsEntry) =>
  e.bestRings !== null && e.bestCorrectedTeiler !== null

// klassisch: Qualifizierte zuerst, dann nach Wert, dann Name (das heutige sortEntries,
// aus der Komponente hierher gezogen und um "ringteiler" als expliziten Fall erweitert)
function sortClassic(entries, sort: "rings" | "teiler" | "ringteiler"): SortedSeasonStandingsEntry[]

// alternierend: Blockbildung + Interleave je Block
function sortAlternating(entries, first: "rings" | "teiler"): SortedSeasonStandingsEntry[] {
  const qualified = entries.filter((e) => e.meetsMinSeries && hasValues(e))
  const unqualified = entries.filter((e) => !e.meetsMinSeries && hasValues(e))
  const withoutSeries = entries
    .filter((e) => !hasValues(e))
    .sort(byName)
    .map((e) => ({ ...e, alternatingBy: null as AlternatingBy }))
  return [...interleave(qualified, first), ...interleave(unqualified, first), ...withoutSeries]
}

function interleave(pool, first: "rings" | "teiler"): SortedSeasonStandingsEntry[] {
  const remaining = [...pool]
  const out: SortedSeasonStandingsEntry[] = []
  let turn = first
  while (remaining.length > 0) {
    const [picked] = remaining.splice(bestIndex(remaining, turn), 1)
    out.push({ ...picked, alternatingBy: turn })
    turn = turn === "rings" ? "teiler" : "rings"
  }
  return out
}

/** Index des Besten im Pool für die Metrik; bei Gleichstand alphabetisch. */
function bestIndex(pool, metric: "rings" | "teiler"): number {
  let best = 0
  for (let i = 1; i < pool.length; i++) {
    const diff =
      metric === "rings"
        ? pool[i].bestRings! - pool[best].bestRings! // höher = besser
        : pool[best].bestCorrectedTeiler! - pool[i].bestCorrectedTeiler! // niedriger = besser
    if (diff > 0 || (diff === 0 && byName(pool[i], pool[best]) < 0)) best = i
  }
  return best
}
```

`calculateSeasonStandings` bleibt **unverändert** (inkl. seiner Ringteiler-Basisordnung — sie ist
weiterhin eine deterministische Ausgangsordnung; die Anzeigereihenfolge kommt ab jetzt aus
`sortSeasonStandings`).

### Datenfluss (sortiert wird an der Quelle, geschnitten wird danach)

```
calculateSeasonStandings(...)  →  sortSeasonStandings(entries, sort)  →  Tabelle / PDF
                                  sort = resolveSeasonSort(competition.scoringMode,
                                                           competition.seasonSortMode)
```

Vier Konsumenten: Standings-Seite, Dashboard (**sortieren vor `.slice()`**),
`pdf/standings`-Route, öffentliche PDF-Route.

## 4. Betroffene Dateien

**Schema/Plumbing**

- `apps/ringwerk/prisma/schema.prisma` — Enum `SeasonSortMode` + Feld `seasonSortMode`
- `apps/ringwerk/prisma/migrations/<ts>_season_alternating_sort/migration.sql` (generiert)
- `apps/ringwerk/src/lib/competitions/querySelects.ts` — `seasonSortMode: true` in `listSelect`
- `apps/ringwerk/src/lib/competitions/listQueries.ts` — `seasonSortMode: true` im Detail-Select
  (bei `minSeries`/`seasonStart`, ~Zeile 67)
- `apps/ringwerk/src/lib/competitions/types.ts` — `seasonSortMode` in `CompetitionListItem`
  **und** `CompetitionDetail` (Saison-Block)

**Kern + Tests**

- `apps/ringwerk/src/lib/scoring/sortSeasonStandings.ts` (neu)
- `apps/ringwerk/src/lib/scoring/sortSeasonStandings.test.ts` (neu)

**Tabelle**

- `apps/ringwerk/src/components/app/series/SeasonStandingsTable.tsx`
- `apps/ringwerk/src/app/(app)/competitions/[id]/standings/page.tsx`
- `apps/ringwerk/src/app/(app)/page.tsx` (Saison-Zweig + Dashboard-Karte)

**PDF**

- `apps/ringwerk/src/lib/pdf/SeasonStandingsPdf.tsx`
- `apps/ringwerk/src/app/api/competitions/[id]/pdf/standings/route.ts`
- `apps/ringwerk/src/app/api/public/c/[slug]/pdf/route.ts` (`buildSeasonStandingsElement`)

**Formular + Actions**

- `apps/ringwerk/src/components/app/competitions/competition-form/constants.ts`
- `apps/ringwerk/src/components/app/competitions/competition-form/useCompetitionFormState.ts`
- `apps/ringwerk/src/components/app/competitions/competition-form/BasicFieldsSection.tsx`
- `apps/ringwerk/src/lib/competitions/actions/baseSchema.ts`
- `apps/ringwerk/src/lib/competitions/actions/create.ts`
- `apps/ringwerk/src/lib/competitions/actions/update.ts`
- `apps/ringwerk/src/lib/auditLog/formatDetails.ts`

**Wissen**

- `vault/apps/ringwerk/season-mode.md`, `vault/apps/ringwerk/ringwerk-data-model.md`

## 5. Required Docs (vor der Umsetzung lesen)

- `vault/conventions.md` — §2 Komponenten-Kanon, §3 Typografie/Kontrast (kein Opazitäts-Modifier
  auf `text-muted-foreground`, nichts unter `text-xs`), §4 Farb-Tokens (keine Palette-Klassen,
  kein `dark:`), §6 Formatierung + ActionResult-Kanon, §8 Gates
- `vault/apps/ringwerk/season-mode.md` + `factor-correction.md` (`effectiveTeilerFaktor` greift nur
  bei `Competition.disciplineId === null`)
- `vault/decisions/adr-023.md` — Autopilot-Grenzen (siehe Hinweis bei Task 1)
- `vault/incidents/best-of-standings-direct-comparison-tiebreak.md` — Vorbild für „Sortierkriterium
  sichtbar machen, Tabelle und PDF byte-identisch"

## 6. Tasks

Jede Task = ein Commit, `pnpm check` als Gate.

### Task 1 — Schema, Migration, Plumbing

⚠️ **Circuit-Breaker:** `prisma/schema.prisma` + `prisma/migrations/` sind für den autonomen
`/implement` gesperrte Pfade (ADR-023). Diese Task erfordert die Freigabe des Users bzw. einen
manuellen `/migrate`-Lauf; der Autopilot hält hier an.

1. `schema.prisma`: neues Enum nach `TeamScoring` einfügen —

   ```prisma
   enum SeasonSortMode {
     ALT_RINGS_FIRST  // alternierend, beginnend mit den besten Ringen
     ALT_TEILER_FIRST // alternierend, beginnend mit dem besten (korrigierten) Teiler
   }
   ```

2. `Competition`, Saison-Block (bei `minSeries`): `seasonSortMode SeasonSortMode?`
   mit Kommentar „null = klassische Sortierung, abgeleitet aus scoringMode".
3. Migration: `/migrate` bzw.
   `pnpm --filter ringwerk exec prisma migrate dev --name season_alternating_sort`
   (rein additiv: neuer Enum-Typ + nullbare Spalte, kein Backfill — Bestandswettbewerbe behalten
   ihre heutige Sortierung).
4. `querySelects.ts` → `seasonSortMode: true` in `listSelect`; `listQueries.ts` → dasselbe im
   Detail-Select; `types.ts` → `seasonSortMode: SeasonSortMode | null` in beiden Typen
   (Import ergänzen).

### Task 2 — `sortSeasonStandings` + Tests

1. Datei wie in §3 anlegen. `sortClassic` ist das heutige `sortEntries` aus
   `SeasonStandingsTable.tsx` (Qualifizierte zuerst → Wert → Name), erweitert auf den expliziten
   `"ringteiler"`-Fall und mit `alternatingBy: null`.
2. `sortSeasonStandings.test.ts` mit diesen Fällen:
   - `resolveSeasonSort`: alle 5 Ergebnisse inkl. „`seasonSortMode` gewinnt über `scoringMode`".
   - `alt-teiler`, 4 Teilnehmer mit disjunkten Bestwerten → Reihenfolge
     bester Teiler → beste Ringe → zweitbester Teiler → zweitbeste Ringe;
     `alternatingBy` = `teiler, rings, teiler, rings`.
   - `alt-rings` auf demselben Fixture → gespiegelte Reihenfolge.
   - Ein Teilnehmer ist in **beiden** Metriken der Beste → er steht auf Platz 1, Platz 2 ist der
     Zweitbeste der anderen Metrik; jeder Teilnehmer genau einmal.
   - Ungerade Anzahl (3) → letzter Platz vom Rest belegt, `alternatingBy` passt zum Turn.
   - Gleichstand in einer Metrik → alphabetisch.
   - `meetsMinSeries: false` → nach allen Qualifizierten, innerhalb des Blocks alternierend.
   - Teilnehmer ohne Serie (`bestRings === null`) → zuletzt, alphabetisch, `alternatingBy: null`.
   - Invariante über ein 6er-Fixture: gleiche Länge, gleiche Menge an `participantId` wie die
     Eingabe (nichts verloren, nichts doppelt) — für alle 5 Sortierungen.
   - Klassische Modi: `rings` absteigend, `teiler`/`ringteiler` aufsteigend, Qualifizierte zuerst
     (Parität zum heutigen Verhalten).
   Fixture-Helfer analog `calculateSeasonStandings.test.ts` (dort `makeSeries`); hier direkt
   `SeasonStandingsEntry`-Objekte bauen (`makeEntry(name, {rings, teiler, ringteiler, meetsMinSeries})`).

### Task 3 — Tabelle + ihre zwei Aufrufer

1. `SeasonStandingsTable.tsx`:
   - Props: `entries: SortedSeasonStandingsEntry[]`, `minSeries: number | null`,
     `sort: ResolvedSeasonSort`, `isMixed?: boolean`. Prop `scoringMode` **entfällt**.
   - `sortEntries`/`defaultSortCol` aus der Datei entfernen (jetzt in `sortSeasonStandings`).
   - `isAlternatingSort(sort)` → **keine** Klick-Header (`SortHeader` wird nicht gerendert,
     stattdessen normale `TableHead` im gleichen Stil, ohne `cursor-pointer`/`hover:`), **kein**
     `useState`, Reihenfolge = `entries` wie geliefert.
     Über der Tabelle:
     `<p className="text-sm text-muted-foreground">Sortierung: {SEASON_SORT_LABELS[sort]} — hervorgehoben ist der Wert, der den Platz ergeben hat.</p>`
   - sonst: heutiges Verhalten — `useState<SortCol>` initial aus `sort`
     (`sort === "alt-…"` kommt hier nicht vor), Klick-Header, Umsortieren via
     `sortSeasonStandings(entries, sortCol)`.
   - Zellen-Hervorhebung: pro Metrik-Zelle
     `className={entry.alternatingBy === null ? <heute> : entry.alternatingBy === "rings" ? "font-medium" : "text-muted-foreground"}`
     (analog für die Teiler-Zelle). Die Ringteiler-Zelle ist in den alternierenden Modi immer
     `text-muted-foreground`. Keine Opazitäts-Modifier (§3).
2. `standings/page.tsx`:
   ```ts
   const sort = resolveSeasonSort(competition.scoringMode, competition.seasonSortMode)
   const standings = sortSeasonStandings(calculateSeasonStandings(...), sort)
   ```
   Tabelle bekommt `sort` statt `scoringMode`. Badge-Zeile: zusätzlich
   `{isAlternatingSort(sort) && <Badge variant="outline">Sortierung: {SEASON_SORT_LABELS[sort]}</Badge>}`
   (der Wertungsmodus-Badge bleibt).
3. `(app)/page.tsx`: im Saison-`Promise.all` nach `calculateSeasonStandings` sortieren und `sort`
   mitgeben (`{ competition: c, standings, minSeries, sort }`); die Karte rendert
   `standings.slice(0, PREVIEW_ROWS)` — jetzt korrekt, weil vorher sortiert wurde — und übergibt
   `sort`.

### Task 4 — PDF + die zwei Routen

1. `SeasonStandingsPdf.tsx`:
   - Props: `entries: SortedSeasonStandingsEntry[]` + `sort: ResolvedSeasonSort`
     (`scoringMode` bleibt für die Config-Zeile).
   - `StandingsTable` bekommt `sort` durchgereicht; `MetricCell`-`muted` wird pro Zeile aus
     `entry.alternatingBy` bestimmt: in den alternierenden Modi ist genau die maßgebliche Metrik
     **nicht** muted, die anderen zwei muted; in den klassischen Modi bleibt es beim heutigen Bild
     (Ringe normal, Teiler muted, Ringteiler normal).
   - Config-Zeile: bei alternierender Sortierung ein weiterer `Text`
     `Sortierung: {SEASON_SORT_LABELS[sort]}` und darunter eine Legendenzeile (fontSize 9,
     `PDF_COLORS.muted`): `Hervorgehoben: der Wert, der den Platz ergeben hat.`
   - Keine Spaltenbreiten-Änderung (`W_WITH_SERIES`/`W_NO_SERIES` bleiben).
2. `api/competitions/[id]/pdf/standings/route.ts` und
   `api/public/c/[slug]/pdf/route.ts` → `buildSeasonStandingsElement`: `sort` auflösen, Einträge
   durch `sortSeasonStandings` schicken, `sort` als Prop mitgeben.

### Task 5 — Formular + Actions

1. `constants.ts`:
   - `SEASON_SCORING_MODE_LABELS` → `SERIES_SCORING_MODE_LABELS` umbenennen (wird auch für LEAGUE
     genutzt — der heutige Name führt in die Irre); Verwendung in `BasicFieldsSection.tsx`
     nachziehen.
   - neu:
     ```ts
     export const SEASON_SORT_MODES = ["ALT_RINGS_FIRST", "ALT_TEILER_FIRST"] as const
     export const SEASON_WERTUNG_LABELS: Record<string, string> = {
       ...SERIES_SCORING_MODE_LABELS,
       ALT_RINGS_FIRST: "Ringe/Teiler alternierend",
       ALT_TEILER_FIRST: "Teiler/Ringe alternierend",
     }
     ```
2. `useCompetitionFormState.ts`:
   ```ts
   const [seasonSortMode, setSeasonSortMode] = useState<string>(competition?.seasonSortMode ?? "")
   const seasonWertung = seasonSortMode !== "" ? seasonSortMode : scoringMode
   function setSeasonWertung(v: string) {
     if (v === "ALT_RINGS_FIRST" || v === "ALT_TEILER_FIRST") {
       setSeasonSortMode(v)
       setScoringMode("RINGTEILER") // neutral: Eingabeformat folgt der Disziplin
     } else {
       setSeasonSortMode("")
       setScoringMode(v)
     }
   }
   ```
   beides plus `seasonWertung` im Rückgabeobjekt.
3. `BasicFieldsSection.tsx`, Block „Wertungsmodus":
   - `const isSeason = type === "SEASON" || (isEdit && competition?.type === "SEASON")`
   - bei `isSeason`: `value={seasonWertung}`, `onValueChange={setSeasonWertung}`, Optionen aus
     `SEASON_WERTUNG_LABELS`; sonst wie heute.
   - zusätzliches Hidden-Feld: `<input type="hidden" name="seasonSortMode" value={seasonSortMode} />`
     (das bestehende Hidden-Feld für `scoringMode` bleibt).
   - Hinweis bei gewählter alternierender Sortierung:
     `<p className="text-xs text-muted-foreground">Die Rangliste wechselt zeilenweise zwischen bestem Teiler und besten Ringen; Tabelle und PDF nutzen dieselbe Reihenfolge, manuelles Sortieren ist deaktiviert. Das Eingabeformat der Ringe folgt der Disziplin.</p>`
4. `baseSchema.ts`: `SEASON_SORT_MODES` importieren bzw. lokal spiegeln (die Datei hält ihre
   Konstanten selbst — dort ein `const SEASON_SORT_MODES = [...] as const` analog zu
   `PLAYOFF_SCORING_MODES`) und ins Objekt aufnehmen:
   ```ts
   seasonSortMode: z.preprocess(
     (v) => (!v || v === "" ? null : v),
     z.enum(SEASON_SORT_MODES).nullable()
   ),
   ```
   Kein `superRefine` nötig: die Typ-Eingrenzung passiert wie bei `minSeries`/`seasonStart` in den
   Actions.
5. `create.ts`: `seasonSortMode: formData.get("seasonSortMode")` in den `safeParse`-Input;
   in `data`: `seasonSortMode: type === "SEASON" ? (parsed.data.seasonSortMode ?? null) : null,`;
   Audit-`details` um `seasonSortMode` ergänzen.
6. `update.ts`: dasselbe im `safeParse`-Input; in `data`:
   `seasonSortMode: type === "SEASON" ? (parsed.data.seasonSortMode ?? null) : undefined,`
   (SEASON hat keine Matchups → `rulesetLocked` ist hier immer false); Audit-`details` ergänzen.
7. `formatDetails.ts`, Fall `COMPETITION_CREATED`/`COMPETITION_UPDATED`, nach der
   Wertungsmodus-Zeile:
   ```ts
   if (d.seasonSortMode != null) rows.push({ label: "Sortierung", value: str(d.seasonSortMode) })
   ```
8. `next build` ist hier Pflicht (Server Actions berührt, §8).

### Task 6 — Vault

1. `vault/apps/ringwerk/season-mode.md`: Abschnitt zur Sortierung — die drei klassischen Modi
   (aus `scoringMode` abgeleitet) + die zwei alternierenden (`seasonSortMode`), die
   Platzierungsregel aus E6, „eine reine Funktion `sortSeasonStandings` für Tabelle + PDF +
   Dashboard", Hinweis auf die behobenen Bestandsfehler. `keywords:` um
   „alternierende Sortierung / Ringe Teiler alternierend / seasonSortMode" erweitern.
2. `vault/apps/ringwerk/ringwerk-data-model.md`: Feld `seasonSortMode` bei den Saison-Feldern.
3. `/sync-graph` laufen lassen (vault-lint + Cross-Refs).

## 7. Test steps (manuell, gegen die laufende Dev-App)

Vorbereitung: `docker compose -f docker-compose.dev.yml up -d` + `pnpm dev`, Migration angewandt.

1. **Anlegen:** Neuer Wettbewerb, Typ „Saison (Jahrespreisschiessen)", Disziplin
   „Gemischt (Faktor-Korrektur)", Mindestserien 2, Wertungsmodus **„Teiler/Ringe alternierend"** →
   speichern, erneut bearbeiten: die Auswahl zeigt weiterhin „Teiler/Ringe alternierend".
2. **Daten:** 4 Teilnehmer, je 2 Serien, so dass die Bestwerte disjunkt sind — z.B.
   | Teilnehmer | beste Ringe | bester Teiler (LP, Faktor 1,0) |
   | --- | --- | --- |
   | A | 98 | 12,0 |
   | B | 92 | 3,5 |
   | C | 96 | 7,0 |
   | D | 90 | 9,5 |
   Erwartete Reihenfolge (Teiler zuerst): **B (Teiler 3,5) → A (Ringe 98) → C (Teiler 7,0) → D**.
   In jeder Zeile ist genau der maßgebliche Wert hervorgehoben.
3. **Spaltenköpfe:** nicht klickbar, kein Hover-Wechsel, kein Chevron; die Legendenzeile steht über
   der Tabelle.
4. **PDF:** „PDF" herunterladen → gleiche Reihenfolge wie die Tabelle, gleiche Hervorhebung, Zeile
   „Sortierung: Teiler/Ringe alternierend" + Legende in der Kopfzone.
5. **Gespiegelt:** Wettbewerb auf „Ringe/Teiler alternierend" umstellen → Reihenfolge
   **A → B → C → D** (Ringe zuerst); PDF erneut prüfen.
6. **Mindestserien:** einem Teilnehmer eine Serie löschen (unter Mindestserien) → er rutscht hinter
   alle Qualifizierten, bleibt aber im eigenen Block alternierend einsortiert; ein Teilnehmer ohne
   jede Serie steht zuletzt.
7. **Faktor-Korrektur:** in einem gemischten Wettbewerb eine Serie in einer Disziplin mit
   `teilerFaktor ≠ 1` erfassen → die Teiler-Reihenfolge folgt dem **korrigierten** Wert (Spalte
   „Best. Teiler korr.").
8. **Dashboard:** Startseite → die Saison-Karte zeigt dieselben Top-5 wie die Rangliste (auch nach
   Umschalten auf „Ringe" oder „Teiler" — der bisherige Fehler ist damit sichtbar behoben).
9. **Klassische Modi:** Wertungsmodus „Ringe" → Klick-Sortierung wieder da, PDF-Reihenfolge
   entspricht jetzt der Tabelle (Ringe absteigend).
10. **Öffentliches PDF:** Wettbewerb veröffentlichen (Slug setzen) → `/api/public/c/<slug>/pdf`
    zeigt die gleiche Reihenfolge.
11. **Andere Typen:** ein LEAGUE- und ein EVENT-Wettbewerb: die Wertungsmodus-Auswahl enthält die
    zwei neuen Einträge **nicht**; Speichern/Bearbeiten unverändert.

## 8. Verification

- `/check` → alle 5 Gates grün (`lint`, `format:check`, `test`, `tsc`, `next build`).
- `pnpm --filter ringwerk test sortSeasonStandings` → alle neuen Fälle grün;
  `calculateSeasonStandings.test.ts` unverändert grün.
- `scripts/consistency-check.sh` (Release-Gate) — keine Palette-Klassen, keine `dark:`-Varianten,
  keine Opazitäts-Modifier, keine Inline-`Intl`-Formatierung eingeführt.
- Manuelle Schritte §7 1–11 abgehakt; Screenshot Tabelle + PDF für den Report.
- `/validate` schreibt `reports/2026-09-09-season-alternating-sort.md`, danach `/review`.

## 9. Nicht in diesem Scope

- Alternierende Sortierung für EVENT/LEAGUE (dort entscheidet ein Score, nicht drei Metriken).
- Backfill/Änderung bestehender Wettbewerbe — `seasonSortMode` bleibt null, Verhalten wie bisher.
- Der Ringteiler als dritte alternierende Metrik.
