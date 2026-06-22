import { MatchStatus, Round, ScoringType } from "@/generated/prisma/client"

export type { MatchStatus, Round, ScoringType }

export interface MatchupParticipant {
  id: string
  firstName: string
  lastName: string
  withdrawn: boolean
  /** Disziplin-ScoringType des Teilnehmers in diesem Wettbewerb (null = nicht konfiguriert) */
  scoringType: ScoringType | null
  /** Teiler-Korrekturfaktor der Teilnehmer-Disziplin (null = keine per-CP-Disziplin) */
  teilerFaktor: number | null
}

export interface MatchResultSummary {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
  /** Present only for BEST_OF_SINGLE matchups — identifies which duel this result belongs to. */
  duelNumber: number | null
  /** True for Stechschuss (tiebreak) series. */
  isTiebreak: boolean
}

export interface MatchupListItem {
  id: string
  round: Round
  roundIndex: number
  status: MatchStatus
  dueDate: Date | null
  homeParticipant: MatchupParticipant
  awayParticipant: MatchupParticipant | null // null = BYE
  results: MatchResultSummary[]
}

export interface ScheduleStatus {
  hasSchedule: boolean
  hasCompletedMatchups: boolean
  totalMatchups: number
}
