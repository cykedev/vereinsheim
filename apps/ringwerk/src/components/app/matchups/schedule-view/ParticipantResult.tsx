import { Clock } from "lucide-react"
import { formatDecimal1, formatRings } from "@/lib/series/scoring-format"
import type { ScoringType } from "@/generated/prisma/client"
import type { MatchupParticipant, MatchResultSummary } from "@/lib/matchups/types"
import { missingReason } from "@/lib/help/missing"
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
      <div className="font-mono text-xs text-muted-foreground tabular-nums">
        {/* umbrechen nur zwischen den Werten, nie zwischen Zahl und Kürzel */}
        <span className="whitespace-nowrap">{formatRings(result.rings, scoringType)} R</span> ·{" "}
        <span className="whitespace-nowrap">{formatDecimal1(result.teiler)} T</span> ·{" "}
        <span className="whitespace-nowrap">RT {formatDecimal1(result.ringteiler)}</span>
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
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
  if (status === "PENDING") return <PendingClock />
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/** Uhr einer Paarung ohne Ergebnis; der Grund als Tooltip und für Screenreader */
export function PendingClock() {
  const reason = missingReason("noResult")
  return (
    <span
      data-missing="noResult"
      title={reason}
      className="inline-flex items-center justify-center"
    >
      <Clock aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="sr-only">{reason}</span>
    </span>
  )
}
