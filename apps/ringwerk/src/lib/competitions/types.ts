import type {
  CompetitionStatus,
  CompetitionType,
  LeagueFormat,
  ScoringMode,
  ScoringType,
  TargetValueType,
  TeamScoring,
} from "@/generated/prisma/client"

export type CompetitionListItem = {
  id: string
  name: string
  type: CompetitionType
  status: CompetitionStatus
  isPublic: boolean
  publicSlug: string | null
  hasPublicPassword: boolean // derived: true if publicPasswordHash is set; hash itself is never exposed to client
  scoringMode: ScoringMode
  shotsPerSeries: number
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
  } | null
  // Liga
  leagueFormat: LeagueFormat
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  // Event
  eventDate: Date | null
  allowGuests: boolean | null
  teamSize: number | null
  teamScoring: TeamScoring | null
  targetValueType: TargetValueType | null
  // Saison
  seasonStart: Date | null
  seasonEnd: Date | null
  createdAt: Date
  _count: { participants: number }
}

export type CompetitionDetail = {
  id: string
  name: string
  type: CompetitionType
  status: CompetitionStatus
  isPublic: boolean
  publicSlug: string | null
  hasPublicPassword: boolean // derived: true if publicPasswordHash is set; hash itself is never exposed to client
  scoringMode: ScoringMode
  shotsPerSeries: number
  disciplineId: string | null
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
    teilerFaktor: number
  } | null
  // Liga – Regelset
  playoffBestOf: number | null
  playoffHasViertelfinale: boolean
  playoffHasAchtelfinale: boolean
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
  finaleHasSuddenDeath: boolean | null
  // Liga – BEST_OF_SINGLE group-phase config
  leagueFormat: LeagueFormat
  groupBestOf: number | null
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
  groupHasSuddenDeath: boolean
  // Liga – Deadlines
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  // Event
  eventDate: Date | null
  allowGuests: boolean | null
  teamSize: number | null
  teamScoring: TeamScoring | null
  targetValue: number | null
  targetValueType: TargetValueType | null
  // Saison
  minSeries: number | null
  seasonStart: Date | null
  seasonEnd: Date | null
  createdAt: Date
  _count: { matchups: number }
}
