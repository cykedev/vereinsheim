import { formatDateOnly, getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { determineOutcome } from "@/lib/results/calculateResult"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { ResultEntryDialog } from "@/components/app/results/ResultEntryDialog"
import type { ScoringMode } from "@/generated/prisma/client"
import type { MatchupListItem, MatchResultSummary } from "@/lib/matchups/types"
import { ParticipantResult, StatusBadge } from "./ParticipantResult"
import { participantName } from "./types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vereinsheim/ui/table"

interface Props {
  title: string
  matchups: MatchupListItem[]
  deadline: Date | null
  canManage: boolean
  scoringMode: ScoringMode
  shotsPerSeries: number
  competitionTeilerFaktor?: number
}

export function ClassicLegTable({
  title,
  matchups,
  deadline,
  canManage,
  scoringMode,
  shotsPerSeries,
  competitionTeilerFaktor = 1,
}: Props) {
  const tz = getDisplayTimeZone()

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {deadline && (
          <span className="text-sm text-muted-foreground">
            · bis {formatDateOnly(deadline, tz)}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/40">
              <TableHead className="px-2 py-2 text-left font-medium whitespace-normal text-muted-foreground sm:px-4">
                Schütze 1
              </TableHead>
              <TableHead className="px-2 py-2 text-left font-medium whitespace-normal text-muted-foreground sm:px-4">
                Schütze 2
              </TableHead>
              <TableHead className="w-10 px-2 py-2 text-center font-medium text-muted-foreground sm:w-24 sm:px-4">
                Status
              </TableHead>
              {canManage && <TableHead className="w-[60px] px-2 py-2 sm:w-[110px] sm:px-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matchups.map((m) => {
              const isVoid = m.homeParticipant.withdrawn || m.awayParticipant?.withdrawn === true
              const isBye = m.status === "BYE"
              const isCompleted = m.status === "COMPLETED"

              let homeOutcome: "WIN" | "LOSS" | "DRAW" | null = null
              let awayOutcome: "WIN" | "LOSS" | "DRAW" | null = null
              let homeResult: MatchResultSummary | undefined
              let awayResult: MatchResultSummary | undefined

              const homeScoringType = getEffectiveScoringType(
                scoringMode,
                m.homeParticipant.scoringType
                  ? { scoringType: m.homeParticipant.scoringType }
                  : null
              )
              const awayScoringType = m.awayParticipant
                ? getEffectiveScoringType(
                    scoringMode,
                    m.awayParticipant.scoringType
                      ? { scoringType: m.awayParticipant.scoringType }
                      : null
                  )
                : "WHOLE"

              const homeTeilerFaktor = m.homeParticipant.teilerFaktor ?? competitionTeilerFaktor
              const awayTeilerFaktor = m.awayParticipant?.teilerFaktor ?? competitionTeilerFaktor

              if (isCompleted && m.awayParticipant) {
                // For classic matchups: aggregate by summing all regular (non-tiebreak) series
                // per participant — there is only one per side in DOUBLE_ROUND_ROBIN.
                homeResult = m.results.find(
                  (r) => r.participantId === m.homeParticipant.id && !r.isTiebreak
                )
                awayResult = m.results.find(
                  (r) => r.participantId === m.awayParticipant!.id && !r.isTiebreak
                )

                if (homeResult && awayResult) {
                  const raw = determineOutcome(homeResult, awayResult, scoringMode)
                  if (raw === "HOME_WIN") {
                    homeOutcome = "WIN"
                    awayOutcome = "LOSS"
                  } else if (raw === "AWAY_WIN") {
                    homeOutcome = "LOSS"
                    awayOutcome = "WIN"
                  } else {
                    homeOutcome = "DRAW"
                    awayOutcome = "DRAW"
                  }
                }
              }

              return (
                <TableRow
                  key={m.id}
                  className={`transition-colors ${isVoid ? "opacity-50" : "hover:bg-muted/20"}`}
                >
                  <TableCell
                    className={`px-2 py-3 whitespace-normal sm:px-4 ${
                      homeOutcome === "WIN" && !isVoid ? "bg-success/10" : ""
                    }`}
                  >
                    <ParticipantResult
                      participant={m.homeParticipant}
                      result={homeResult}
                      scoringType={homeScoringType}
                      isVoid={isVoid}
                    />
                  </TableCell>
                  <TableCell
                    className={`px-2 py-3 whitespace-normal sm:px-4 ${
                      awayOutcome === "WIN" && !isVoid ? "bg-success/10" : ""
                    }`}
                  >
                    {m.awayParticipant ? (
                      <ParticipantResult
                        participant={m.awayParticipant}
                        result={awayResult}
                        scoringType={awayScoringType}
                        isVoid={isVoid}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-2 py-3 text-center sm:px-4">
                    <StatusBadge status={m.status} />
                  </TableCell>
                  {canManage && (
                    <TableCell className="px-2 py-3 text-right sm:px-4">
                      {!isBye && m.awayParticipant && !isVoid && (
                        <ResultEntryDialog
                          matchupId={m.id}
                          homeName={participantName(m.homeParticipant)}
                          awayName={participantName(m.awayParticipant)}
                          homeParticipantId={m.homeParticipant.id}
                          awayParticipantId={m.awayParticipant.id}
                          existingResults={m.results}
                          isCorrection={isCompleted}
                          homeScoringType={homeScoringType}
                          awayScoringType={awayScoringType}
                          shotsPerSeries={shotsPerSeries}
                          homeTeilerFaktor={homeTeilerFaktor}
                          awayTeilerFaktor={awayTeilerFaktor}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
