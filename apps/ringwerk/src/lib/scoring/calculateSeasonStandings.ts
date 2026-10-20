import { calculateCorrectedTeiler, effectiveTeilerFaktor } from "./calculateScore"
import type { SeasonSeriesItem } from "@/lib/series/types"
import type { CompetitionType, ScoringType } from "@/generated/prisma/client"

export type SeasonStandingsEntry = {
  participantId: string
  participantName: string
  seriesCount: number
  /** Mindestzahl an Serien für diese Zeile: null ohne Mindestzahl, 1 mit Ausnahme (`requiredSeries`) */
  requiredSeries: number | null
  meetsMinSeries: boolean
  // Beste Ringe (höchste Ringzahl einer einzelnen Serie)
  bestRings: number | null
  bestRingsScoringType: ScoringType | null
  bestRings_rank: number | null
  // Bester Teiler (niedrigster korrigierter Teiler einer einzelnen Serie)
  bestCorrectedTeiler: number | null
  bestTeiler_rank: number | null
  // Bester Ringteiler (niedrigster Ringteiler einer einzelnen Serie)
  bestRingteiler: number | null
  bestRingteiler_rank: number | null
}

type ParticipantInput = {
  participantId: string
  participantName: string
  series: SeasonSeriesItem[]
  /** Ausnahme an der Einschreibung: in der Wertung ab der ersten Serie (etwa Jugend) */
  exemptFromMinSeries?: boolean
}

/**
 * Mindestzahl an Serien für eine Zeile — die einzige Stelle der Regel. Ohne Mindestzahl im
 * Wettbewerb keine; mit Ausnahme an der Einschreibung genügt eine Serie; sonst die des Wettbewerbs.
 */
export function requiredSeries(minSeries: number | null, exempt: boolean): number | null {
  if (minSeries === null) return null
  return exempt ? Math.min(1, minSeries) : minSeries
}

/**
 * Die Ausnahme wirkt nur in einer Saison mit einer Mindestzahl über 1. Nur dort bieten Einschreiben
 * und Teilnehmerverwaltung sie an, und nur dort speichern die Actions sie.
 */
export function offersMinSeriesExemption(competition: {
  type: CompetitionType
  minSeries: number | null
}): boolean {
  return (
    competition.type === "SEASON" && competition.minSeries !== null && competition.minSeries > 1
  )
}

/**
 * Berechnet die Saison-Rangliste.
 * Drei unabhängige Wertungen aus je einer einzelnen Serie:
 *   1. Beste Ringe — höchste Ringzahl
 *   2. Bester Teiler — niedrigster korrigierter Teiler (teiler × faktor)
 *   3. Bester Ringteiler — niedrigster Ringteiler
 * Teilnehmer unter ihrer Mindestzahl (`requiredSeries`) werden ausgegraut (meetsMinSeries = false,
 * Rang = null). Mit Ausnahme an der Einschreibung zählt schon die erste Serie.
 */
export function calculateSeasonStandings(
  participants: ParticipantInput[],
  minSeries: number | null,
  competitionDisciplineId: string | null = null
): SeasonStandingsEntry[] {
  if (participants.length === 0) return []

  // Basis-Einträge berechnen
  const entries: Omit<
    SeasonStandingsEntry,
    "bestRings_rank" | "bestTeiler_rank" | "bestRingteiler_rank"
  >[] = participants.map((p) => {
    const seriesCount = p.series.length
    const required = requiredSeries(minSeries, p.exemptFromMinSeries ?? false)
    const meetsMinSeries = required === null || seriesCount >= required

    if (seriesCount === 0) {
      return {
        participantId: p.participantId,
        participantName: p.participantName,
        seriesCount,
        requiredSeries: required,
        meetsMinSeries,
        bestRings: null,
        bestRingsScoringType: null,
        bestCorrectedTeiler: null,
        bestRingteiler: null,
      }
    }

    // Beste Ringe — max
    // Keep first occurrence on ties (first-in-list wins when rings are equal)
    const bestRingsSeries = p.series.reduce(
      (best, s) => (s.rings > best.rings ? s : best),
      p.series[0]
    )
    const bestRings = bestRingsSeries.rings
    const bestRingsScoringType = bestRingsSeries.discipline.scoringType

    // Bester Teiler — min korrigierter Teiler
    const bestCorrectedTeiler = Math.min(
      ...p.series.map((s) =>
        calculateCorrectedTeiler(
          s.teiler,
          effectiveTeilerFaktor(competitionDisciplineId, s.discipline.teilerFaktor)
        )
      )
    )

    // Bester Ringteiler — min (aus derselben Serie, bereits vorberechnet)
    const bestRingteiler = Math.min(...p.series.map((s) => s.ringteiler))

    return {
      participantId: p.participantId,
      participantName: p.participantName,
      seriesCount,
      requiredSeries: required,
      meetsMinSeries,
      bestRings,
      bestRingsScoringType,
      bestCorrectedTeiler,
      bestRingteiler,
    }
  })

  // Metrik-Ränge nur für GEWERTETE Teilnehmer: wer die Mindestserien nicht erreicht, steht nicht
  // in der Wertung und darf keinen Rang tragen — sonst hält eine ausgegraute Zeile die 1 und die
  // Rangfolge der gewerteten Zeilen bekommt Lücken (in der alternierenden Sortierung sofort
  // sichtbar: 1, 2, 3, 3 statt 1, 1, 2, 2). Bei minSeries = null ist jeder qualifiziert.
  const rankedEntries = entries.filter((e) => e.bestRings !== null && e.meetsMinSeries)

  // Rang berechnen: gleiche Werte → gleicher Rang
  function assignRanks(
    ids: string[],
    getValue: (id: string) => number | null,
    ascending: boolean
  ): Map<string, number> {
    const ranks = new Map<string, number>()
    const sorted = ids
      .filter((id) => getValue(id) !== null)
      .sort((a, b) => {
        const va = getValue(a)!
        const vb = getValue(b)!
        return ascending ? va - vb : vb - va
      })

    let rank = 1
    for (let i = 0; i < sorted.length; i++) {
      const id = sorted[i]
      if (i > 0) {
        const prev = sorted[i - 1]
        if (getValue(id) !== getValue(prev)) rank = i + 1
      }
      ranks.set(id, rank)
    }
    return ranks
  }

  const qualifiedIds = rankedEntries.map((e) => e.participantId)
  const entryMap = new Map(entries.map((e) => [e.participantId, e]))

  const ringsRanks = assignRanks(
    qualifiedIds,
    (id) => entryMap.get(id)?.bestRings ?? null,
    false // höher = besser
  )
  const teilerRanks = assignRanks(
    qualifiedIds,
    (id) => entryMap.get(id)?.bestCorrectedTeiler ?? null,
    true // niedriger = besser
  )
  const ringteilerRanks = assignRanks(
    qualifiedIds,
    (id) => entryMap.get(id)?.bestRingteiler ?? null,
    true // niedriger = besser
  )

  // Endergebnis zusammensetzen. Die Reihenfolge hier ist nur eine deterministische
  // Ausgangsordnung — die ANZEIGEreihenfolge kommt aus sortSeasonStandings (Tabelle, PDF,
  // Dashboard). Nach Werten, nicht nach Rängen, damit sie auch ohne Ränge stabil bleibt.
  return entries
    .map((e) => ({
      ...e,
      bestRings_rank: ringsRanks.get(e.participantId) ?? null,
      bestTeiler_rank: teilerRanks.get(e.participantId) ?? null,
      bestRingteiler_rank: ringteilerRanks.get(e.participantId) ?? null,
    }))
    .sort((a, b) => {
      // Qualifizierte zuerst
      if (a.meetsMinSeries !== b.meetsMinSeries) return a.meetsMinSeries ? -1 : 1
      // Nach Ringteiler-Wert (niedriger gewinnt)
      if (a.bestRingteiler !== null && b.bestRingteiler !== null) {
        return a.bestRingteiler - b.bestRingteiler
      }
      if (a.bestRingteiler !== null) return -1
      if (b.bestRingteiler !== null) return 1
      // Ohne Serien: alphabetisch
      return a.participantName.localeCompare(b.participantName)
    })
}
