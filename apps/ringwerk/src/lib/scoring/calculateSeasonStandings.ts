import { calculateCorrectedTeiler, effectiveTeilerFaktor } from "./calculateScore"
import type { SeasonSeriesItem } from "@/lib/series/types"
import type { ScoringType } from "@/generated/prisma/client"

export type SeasonStandingsEntry = {
  participantId: string
  participantName: string
  seriesCount: number
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
}

/**
 * Berechnet die Saison-Rangliste.
 * Drei unabhängige Wertungen aus je einer einzelnen Serie:
 *   1. Beste Ringe — höchste Ringzahl
 *   2. Bester Teiler — niedrigster korrigierter Teiler (teiler × faktor)
 *   3. Bester Ringteiler — niedrigster Ringteiler
 * Teilnehmer unter minSeries werden ausgegraut (meetsMinSeries = false, Rang = null).
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
    const meetsMinSeries = minSeries === null || seriesCount >= minSeries

    if (seriesCount === 0) {
      return {
        participantId: p.participantId,
        participantName: p.participantName,
        seriesCount,
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
