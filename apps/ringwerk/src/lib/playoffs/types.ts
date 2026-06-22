import type { MatchStatus, PlayoffRound } from "@/generated/prisma/client"

export type { PlayoffRound }

export interface PlayoffDuelResultData {
  totalRings: number
  /** null bei Finale (Einzelschüsse ohne Teiler-Erfassung) */
  teiler: number | null
  /** null bei Finale (kein Ringteiler berechnet) */
  ringteiler: number | null
}

export interface PlayoffDuelItem {
  id: string
  duelNumber: number
  isSuddenDeath: boolean
  isCompleted: boolean
  /** Ergebnis von Teilnehmer A (participantA des PlayoffMatch) */
  resultA: PlayoffDuelResultData | null
  /** Ergebnis von Teilnehmer B (participantB des PlayoffMatch) */
  resultB: PlayoffDuelResultData | null
  /** participantAId wenn A gewinnt, participantBId wenn B gewinnt, null wenn offen oder DRAW */
  winnerId: string | null
}

export interface PlayoffParticipant {
  id: string
  firstName: string
  lastName: string
}

export interface PlayoffMatchItem {
  id: string
  round: PlayoffRound
  participantA: PlayoffParticipant
  participantB: PlayoffParticipant
  winsA: number
  winsB: number
  status: MatchStatus
  duels: PlayoffDuelItem[]
  /** Korrektur und Löschen erlaubt: FINAL immer, QF/HF nur wenn Folge-Runde noch nicht angesetzt */
  canCorrect: boolean
}

export interface PlayoffBracketData {
  competitionId: string
  eighthFinals: PlayoffMatchItem[]
  quarterFinals: PlayoffMatchItem[]
  semiFinals: PlayoffMatchItem[]
  final: PlayoffMatchItem | null
}

export interface SavePlayoffDuelResultInput {
  duelId: string
  totalRingsA: number
  /** undefined bei Finale (Einzelschüsse ohne Teiler) */
  teilerA?: number
  totalRingsB: number
  /** undefined bei Finale (Einzelschüsse ohne Teiler) */
  teilerB?: number
}
