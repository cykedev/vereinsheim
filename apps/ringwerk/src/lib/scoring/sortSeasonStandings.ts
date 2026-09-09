import type { ScoringMode, SeasonSortMode } from "@/generated/prisma/client"
import type { SeasonStandingsEntry } from "./calculateSeasonStandings"

/**
 * Die Metrik, die eine Zeile auf ihren Platz gebracht hat.
 * Nur in den alternierenden Modi gesetzt — sonst null.
 */
export type AlternatingBy = "rings" | "teiler" | null

export type SortedSeasonStandingsEntry = SeasonStandingsEntry & { alternatingBy: AlternatingBy }

/** Aufgelöste Anzeigereihenfolge: eine der drei Metriken oder eine der beiden alternierenden Folgen. */
export type ResolvedSeasonSort = "rings" | "teiler" | "ringteiler" | "alt-rings" | "alt-teiler"

export const SEASON_SORT_LABELS: Record<ResolvedSeasonSort, string> = {
  rings: "Beste Ringe",
  teiler: "Bester Teiler",
  ringteiler: "Bester Ringteiler",
  "alt-rings": "Ringe/Teiler alternierend",
  "alt-teiler": "Teiler/Ringe alternierend",
}

/**
 * Bestimmt die Anzeigereihenfolge einer Saison-Rangliste.
 * `seasonSortMode` gewinnt, wenn gesetzt; sonst folgt die Reihenfolge dem Wertungsmodus
 * (wie bisher; alles außer Ringe/Teiler landet auf Ringteiler).
 */
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

/**
 * Bringt die Saison-Rangliste in ihre Anzeigereihenfolge — die einzige Quelle dafür.
 * Tabelle, PDF und Dashboard nutzen dieselbe Funktion, damit sie nie auseinanderlaufen.
 * Die Originalliste wird nicht verändert, die Einzelränge bleiben unangetastet.
 *
 * Klassisch: Qualifizierte zuerst, dann nach dem Wert der Metrik, dann alphabetisch.
 * Alternierend: je Block (Qualifizierte, Nicht-Qualifizierte) wird zeilenweise zwischen den
 * besten Ringen und dem besten korrigierten Teiler gewechselt; jeder Teilnehmer erscheint
 * genau einmal, Teilnehmer ohne Serie stehen alphabetisch am Ende.
 */
export function sortSeasonStandings(
  entries: SeasonStandingsEntry[],
  sort: ResolvedSeasonSort
): SortedSeasonStandingsEntry[] {
  if (sort === "alt-rings") return sortAlternating(entries, "rings")
  if (sort === "alt-teiler") return sortAlternating(entries, "teiler")
  return sortClassic(entries, sort)
}

const byName = (a: SeasonStandingsEntry, b: SeasonStandingsEntry): number =>
  a.participantName.localeCompare(b.participantName, "de")

/** Werte in beiden alternierenden Metriken vorhanden — gilt genau für seriesCount > 0. */
const hasValues = (e: SeasonStandingsEntry): boolean =>
  e.bestRings !== null && e.bestCorrectedTeiler !== null

function sortClassic(
  entries: SeasonStandingsEntry[],
  sort: "rings" | "teiler" | "ringteiler"
): SortedSeasonStandingsEntry[] {
  return [...entries]
    .sort((a, b) => {
      // Qualifizierte zuerst
      if (a.meetsMinSeries !== b.meetsMinSeries) return a.meetsMinSeries ? -1 : 1

      // Nach Wert sortieren (nicht nach Rang, damit auch Nicht-Qualifizierte sortiert werden)
      if (sort === "rings") {
        if (a.bestRings !== null && b.bestRings !== null) return b.bestRings - a.bestRings
        if (a.bestRings !== null) return -1
        if (b.bestRings !== null) return 1
      } else if (sort === "teiler") {
        if (a.bestCorrectedTeiler !== null && b.bestCorrectedTeiler !== null)
          return a.bestCorrectedTeiler - b.bestCorrectedTeiler
        if (a.bestCorrectedTeiler !== null) return -1
        if (b.bestCorrectedTeiler !== null) return 1
      } else {
        if (a.bestRingteiler !== null && b.bestRingteiler !== null)
          return a.bestRingteiler - b.bestRingteiler
        if (a.bestRingteiler !== null) return -1
        if (b.bestRingteiler !== null) return 1
      }
      return byName(a, b)
    })
    .map((e) => ({ ...e, alternatingBy: null }))
}

function sortAlternating(
  entries: SeasonStandingsEntry[],
  first: "rings" | "teiler"
): SortedSeasonStandingsEntry[] {
  const qualified = entries.filter((e) => e.meetsMinSeries && hasValues(e))
  const unqualified = entries.filter((e) => !e.meetsMinSeries && hasValues(e))
  const withoutSeries = [...entries]
    .filter((e) => !hasValues(e))
    .sort(byName)
    .map((e) => ({ ...e, alternatingBy: null as AlternatingBy }))

  return [...interleave(qualified, first), ...interleave(unqualified, first), ...withoutSeries]
}

/** Belegt die Plätze eines Blocks abwechselnd aus beiden Metriken. */
function interleave(
  pool: SeasonStandingsEntry[],
  first: "rings" | "teiler"
): SortedSeasonStandingsEntry[] {
  const remaining = [...pool]
  const placed: SortedSeasonStandingsEntry[] = []
  let turn = first

  while (remaining.length > 0) {
    const [picked] = remaining.splice(bestIndex(remaining, turn), 1)
    placed.push({ ...picked, alternatingBy: turn })
    turn = turn === "rings" ? "teiler" : "rings"
  }

  return placed
}

/** Index des Besten im Pool für diese Metrik; bei Gleichstand alphabetisch. */
function bestIndex(pool: SeasonStandingsEntry[], metric: "rings" | "teiler"): number {
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
