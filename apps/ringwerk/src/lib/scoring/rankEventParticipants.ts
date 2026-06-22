import type { ScoringMode, ScoringType, TargetValueType } from "@/generated/prisma/client"
import type { EventSeriesItem } from "@/lib/series/types"
import { calculateScore, calculateCorrectedTeiler, effectiveTeilerFaktor } from "./calculateScore"
import { rankByScore } from "./rankParticipants"
import { getMaxRings } from "@/lib/series/scoring-format"

export type EventRankedEntry = {
  rank: number
  seriesId: string
  competitionParticipantId: string | null
  participantId: string
  participantName: string
  disciplineName: string
  disciplineScoringType: ScoringType
  isGuest: boolean
  teamNumber: number | null
  rings: number
  teiler: number
  correctedTeiler: number
  ringteiler: number
  score: number
}

export type EventTeamRankedEntry = {
  rank: number
  teamNumber: number
  teamScore: number
  members: Array<{
    participantId: string
    participantName: string
    rings: number
    teiler: number
    score: number
  }>
}

type EventConfig = {
  scoringMode: ScoringMode
  targetValue: number | null
  targetValueType: TargetValueType | null
  /** Competition.disciplineId — null = gemischt (Faktor aktiv), sonst feste Disziplin (Faktor 1.0). */
  competitionDisciplineId: string | null
  /**
   * @deprecated No longer used for maxRings calculation — per-series discipline.scoringType is used instead.
   * Kept for API compatibility with existing callers.
   */
  discipline: { scoringType: ScoringType } | null
}

/**
 * Berechnet die Rangliste für ein Event.
 * Jede Series entspricht einer Einschreibung (eine Serie pro CompetitionParticipant).
 * Bei Team-Events mit Double-Enrollment identifiziert seriesId jeden Eintrag eindeutig.
 */
export function rankEventParticipants(
  series: EventSeriesItem[],
  config: EventConfig
): EventRankedEntry[] {
  if (series.length === 0) return []

  const entries = series.map((s) => {
    const faktor = effectiveTeilerFaktor(config.competitionDisciplineId, s.discipline.teilerFaktor)
    // Use per-series scoringType so mixed events correctly use 109 for DECIMAL disciplines.
    const maxRings = getMaxRings(s.discipline.scoringType, s.shotCount)
    const correctedTeiler = calculateCorrectedTeiler(s.teiler, faktor)

    const measuredValue = buildMeasuredValue(s, faktor, config.targetValueType)

    const score = calculateScore(config.scoringMode, {
      rings: s.rings,
      teiler: s.teiler,
      faktor,
      maxRings,
      targetValue: config.targetValue ?? undefined,
      measuredValue,
      shots: s.shots,
    })

    return {
      seriesId: s.id,
      competitionParticipantId: s.competitionParticipantId,
      participantId: s.participantId,
      participantName: `${s.participant.firstName} ${s.participant.lastName}`,
      disciplineName: s.discipline.name,
      disciplineScoringType: s.discipline.scoringType,
      isGuest: s.isGuest,
      teamNumber: s.teamNumber,
      rings: s.rings,
      teiler: s.teiler,
      correctedTeiler,
      ringteiler: s.ringteiler,
      score,
    }
  })

  // Use seriesId as identity key to correctly handle double enrollment
  const ranked = rankByScore(
    entries.map((e) => ({ participantId: e.seriesId, score: e.score })),
    config.scoringMode
  )

  return ranked.map((r) => {
    const entry = entries.find((e) => e.seriesId === r.participantId)!
    return { ...entry, rank: r.rank }
  })
}

/**
 * Berechnet die Team-Rangliste für ein Team-Event.
 * teamScoring: "SUM" = Summe aller Teamnmitglieder-Scores, "BEST" = bester Score im Team.
 * Nur Teams mit mindestens einer gemeldeten Serie werden gerankt.
 */
export function rankEventTeams(
  individualRanking: EventRankedEntry[],
  teamScoring: "SUM" | "BEST",
  scoringMode: ScoringMode
): EventTeamRankedEntry[] {
  // Gruppe nach Team
  const teamMap = new Map<number, { members: EventRankedEntry[] }>()

  for (const entry of individualRanking) {
    if (entry.teamNumber === null) continue
    const existing = teamMap.get(entry.teamNumber) ?? { members: [] }
    existing.members.push(entry)
    teamMap.set(entry.teamNumber, existing)
  }

  if (teamMap.size === 0) return []

  const teamEntries = Array.from(teamMap.entries()).map(([teamNumber, { members }]) => {
    const teamScore = computeTeamScore(
      members.map((m) => m.score),
      teamScoring,
      scoringMode
    )
    return {
      teamNumber,
      teamScore,
      members: members.map((m) => ({
        participantId: m.participantId,
        participantName: m.participantName,
        rings: m.rings,
        teiler: m.teiler,
        score: m.score,
      })),
    }
  })

  const ranked = rankByScore(
    teamEntries.map((t) => ({ participantId: String(t.teamNumber), score: t.teamScore })),
    scoringMode
  )

  return ranked.map((r) => {
    const entry = teamEntries.find((t) => String(t.teamNumber) === r.participantId)!
    return { ...entry, rank: r.rank }
  })
}

/**
 * Berechnet den Team-Score aus Einzel-Scores.
 * SUM: Summe aller Scores (bei asc-Modi addieren sich die Teiler — kleinerer Gesamtteiler gewinnt).
 * BEST: Bester Score im Team (niedrigster Teiler / höchste Ringe).
 */
function computeTeamScore(
  scores: number[],
  teamScoring: "SUM" | "BEST",
  scoringMode: ScoringMode
): number {
  if (scores.length === 0) return 0
  if (teamScoring === "SUM") {
    return scores.reduce((a, b) => a + b, 0)
  }
  // BEST: asc-Modi → minimum, desc-Modi → maximum
  const ascModes: ScoringMode[] = [
    "RINGTEILER",
    "TEILER",
    "TARGET_ABSOLUTE",
    "TARGET_UNDER",
    "TARGET_OVER",
  ]
  return ascModes.includes(scoringMode) ? Math.min(...scores) : Math.max(...scores)
}

/**
 * Ermittelt den Messwert für TARGET-Modi.
 * Basis ist targetValueType: TEILER → korrigierter Teiler; RINGS / RINGS_DECIMAL → Ringe.
 */
function buildMeasuredValue(
  s: EventSeriesItem,
  faktor: number,
  targetValueType: TargetValueType | null
): number {
  if (!targetValueType) return s.rings
  switch (targetValueType) {
    case "TEILER":
      return calculateCorrectedTeiler(s.teiler, faktor)
    case "RINGS":
    case "RINGS_DECIMAL":
      return s.rings
  }
}
