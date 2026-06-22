import { Clock } from "lucide-react"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { BestOfEntryDialog } from "@/components/app/matchups/BestOfEntryDialog"
import type { ScoringMode } from "@/generated/prisma/client"
import type { MatchupListItem } from "@/lib/matchups/types"
import { deriveBestOfLabel } from "./bestOfLabel"
import { participantName, type BestOfConfig } from "./types"

interface Props {
  matchups: MatchupListItem[]
  canManage: boolean
  scoringMode: ScoringMode
  shotsPerSeries: number
  bestOfConfig: BestOfConfig
}

export function BestOfMatchupTable({
  matchups,
  canManage,
  scoringMode,
  shotsPerSeries,
  bestOfConfig,
}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">
              Teilnehmer A
            </th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">
              Teilnehmer B
            </th>
            <th className="w-28 px-2 py-2 text-center font-medium text-muted-foreground sm:px-4">
              Stand
            </th>
            {canManage && <th className="w-[50px] px-2 py-2 sm:w-[60px] sm:px-4" />}
          </tr>
        </thead>
        <tbody className="divide-y">
          {matchups.map((m) => {
            const isBye = m.status === "BYE" || !m.awayParticipant
            const isVoid = m.homeParticipant.withdrawn || m.awayParticipant?.withdrawn === true

            if (isBye) {
              return (
                <tr key={m.id} className="opacity-60">
                  <td className="px-2 py-3 sm:px-4">
                    <span className="font-medium">{participantName(m.homeParticipant)}</span>
                  </td>
                  <td className="px-2 py-3 text-muted-foreground sm:px-4">—</td>
                  <td className="px-2 py-3 text-center sm:px-4">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Freilos
                    </span>
                  </td>
                  {canManage && <td className="px-2 py-3 sm:px-4" />}
                </tr>
              )
            }

            if (isVoid) {
              return (
                <tr key={m.id} className="opacity-50">
                  <td className="px-2 py-3 sm:px-4">
                    <span className="line-through text-muted-foreground">
                      {participantName(m.homeParticipant)}
                    </span>
                  </td>
                  <td className="px-2 py-3 sm:px-4">
                    <span className="line-through text-muted-foreground">
                      {participantName(m.awayParticipant!)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground sm:px-4">—</td>
                  {canManage && <td className="px-2 py-3 sm:px-4" />}
                </tr>
              )
            }

            const scoringType = getEffectiveScoringType(
              scoringMode,
              m.homeParticipant.scoringType ? { scoringType: m.homeParticipant.scoringType } : null
            )

            const { label, isComplete, winner } = deriveBestOfLabel(
              m.homeParticipant.id,
              m.awayParticipant!.id,
              m.results,
              bestOfConfig.disciplineId,
              scoringMode,
              bestOfConfig.groupTiebreaker1,
              bestOfConfig.groupTiebreaker2,
              bestOfConfig.groupBestOf,
              bestOfConfig.groupPlayAllDuels
            )

            const hasResults = m.results.length > 0

            return (
              <tr key={m.id} className="transition-colors hover:bg-muted/20">
                <td className={`px-2 py-3 sm:px-4 ${winner === "home" ? "bg-emerald-500/10" : ""}`}>
                  <span className="font-medium">{participantName(m.homeParticipant)}</span>
                </td>
                <td className={`px-2 py-3 sm:px-4 ${winner === "away" ? "bg-emerald-500/10" : ""}`}>
                  <span className="font-medium">{participantName(m.awayParticipant!)}</span>
                </td>
                <td className="px-2 py-3 text-center sm:px-4">
                  {isComplete ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {label}
                    </span>
                  ) : hasResults ? (
                    <span className="text-xs text-muted-foreground">{label}</span>
                  ) : (
                    <span className="inline-flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="px-2 py-3 text-right sm:px-4">
                    <BestOfEntryDialog
                      matchupId={m.id}
                      homeParticipant={m.homeParticipant}
                      awayParticipant={m.awayParticipant!}
                      series={m.results}
                      canManage={canManage}
                      hasResults={hasResults}
                      scoringMode={scoringMode}
                      disciplineId={bestOfConfig.disciplineId}
                      groupBestOf={bestOfConfig.groupBestOf}
                      groupPlayAllDuels={bestOfConfig.groupPlayAllDuels}
                      groupTiebreaker1={bestOfConfig.groupTiebreaker1}
                      groupTiebreaker2={bestOfConfig.groupTiebreaker2}
                      shotsPerSeries={shotsPerSeries}
                      scoringType={scoringType}
                      teilerFaktor={bestOfConfig.competitionTeilerFaktor}
                    />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
