import { useState } from "react"
import type { MatchResultSummary, MatchupParticipant } from "@/lib/matchups/types"
import type { ScoringMode } from "@/generated/prisma/client"
import {
  completedDuelNumbers,
  completedStechschussNumbers,
  countDuelWins,
  deriveMatchStatus,
} from "./bestOfStatus"
import { useDuelInput } from "./useDuelInput"

interface Args {
  matchupId: string
  homeParticipant: MatchupParticipant
  awayParticipant: MatchupParticipant
  series: MatchResultSummary[]
  scoringMode: ScoringMode
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
}

export function useBestOfEntry({
  matchupId,
  homeParticipant,
  awayParticipant,
  series,
  scoringMode,
  disciplineId,
  groupBestOf,
  groupPlayAllDuels,
  groupTiebreaker1,
  groupTiebreaker2,
}: Args) {
  const [open, setOpen] = useState(false)

  const homeId = homeParticipant.id
  const awayId = awayParticipant.id

  const homeName = `${homeParticipant.firstName} ${homeParticipant.lastName}`
  const awayName = `${awayParticipant.firstName} ${awayParticipant.lastName}`

  const matchStatus = deriveMatchStatus(
    homeId,
    awayId,
    series,
    disciplineId,
    scoringMode,
    groupTiebreaker1,
    groupTiebreaker2,
    groupBestOf,
    groupPlayAllDuels
  )

  const { homeWins, awayWins } = countDuelWins(
    homeId,
    awayId,
    series,
    disciplineId,
    scoringMode,
    groupTiebreaker1,
    groupTiebreaker2,
    matchStatus
  )

  const duelNumbers = completedDuelNumbers(homeId, awayId, series)
  const stechschussNumbers = completedStechschussNumbers(homeId, awayId, series)
  const nextDuelNumber = duelNumbers.length > 0 ? Math.max(...duelNumbers) + 1 : 1

  const isComplete = matchStatus.kind === "complete"
  const winnerId = isComplete ? (matchStatus.winner === "A" ? homeId : awayId) : null

  const input = useDuelInput({ matchupId, nextDuelNumber })

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) input.resetInputs()
    setOpen(isOpen)
  }

  return {
    ...input,
    open,
    setOpen,
    homeId,
    awayId,
    homeName,
    awayName,
    matchStatus,
    homeWins,
    awayWins,
    duelNumbers,
    stechschussNumbers,
    nextDuelNumber,
    isComplete,
    winnerId,
    handleOpenChange,
  }
}

export type BestOfEntryState = ReturnType<typeof useBestOfEntry>
