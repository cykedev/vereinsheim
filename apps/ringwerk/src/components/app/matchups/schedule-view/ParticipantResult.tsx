import { Clock } from "lucide-react"
import { formatDecimal1, formatRings } from "@/lib/series/scoring-format"
import type { ScoringType } from "@/generated/prisma/client"
import type { MatchupParticipant, MatchResultSummary } from "@/lib/matchups/types"
import { participantName, STATUS_LABEL } from "./types"

interface ParticipantResultProps {
  participant: MatchupParticipant
  result: MatchResultSummary | undefined
  scoringType: ScoringType
  isVoid?: boolean
}

/** Zeigt Name + Ergebnis-Zeile für einen Teilnehmer */
export function ParticipantResult({
  participant,
  result,
  scoringType,
  isVoid = false,
}: ParticipantResultProps) {
  const name = participantName(participant)

  if (isVoid || participant.withdrawn) {
    return (
      <div>
        <span className="line-through text-muted-foreground">{name}</span>
      </div>
    )
  }

  if (!result) {
    return <div className="font-medium">{name}</div>
  }

  return (
    <div className="space-y-0.5">
      <div className="font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">
        {formatRings(result.rings, scoringType)} R · {formatDecimal1(result.teiler)} T · RT{" "}
        {formatDecimal1(result.ringteiler)}
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        ✓
      </span>
    )
  }
  if (status === "BYE" || status === "WALKOVER") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {STATUS_LABEL[status]}
      </span>
    )
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center justify-center">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}
