import { Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { PlayoffDuelResultDialog } from "../PlayoffDuelResultDialog"
import type { PlayoffCardConfig } from "./types"
import type { PlayoffMatchCardState } from "./usePlayoffMatchCard"

interface Props {
  match: PlayoffMatchItem
  canManage: boolean
  config: PlayoffCardConfig
  card: PlayoffMatchCardState
}

// Liste der Duelle/Schussreihen einer Playoff-Begegnung.
export function DuelRows({ match, canManage, config, card }: Props) {
  if (match.duels.length === 0) return null
  const { scoringType, shotsPerSeries, finalePrimary, finaleTiebreaker1, finaleTiebreaker2 } =
    config
  const { isFinal, lastDuelId, nextPendingDuel, submitting, setConfirmDuelId } = card

  return (
    <div className="divide-y divide-border rounded-md border text-xs">
      {match.duels.map((duel) => {
        const isWinnerA = duel.winnerId === match.participantA.id
        const isWinnerB = duel.winnerId === match.participantB.id
        const isDraw = duel.isCompleted && duel.winnerId === null

        return (
          <div key={duel.id} className="flex items-center gap-2 px-2 py-2 sm:px-3">
            <span className="w-20 text-muted-foreground">
              {duel.isSuddenDeath
                ? isFinal
                  ? "Verlängerung"
                  : "Entscheid"
                : isFinal
                  ? `${shotsPerSeries} Sch.`
                  : `Duell ${duel.duelNumber}`}
            </span>

            {duel.isCompleted && duel.resultA && duel.resultB ? (
              <>
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-right tabular-nums ${isWinnerA ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {isFinal
                    ? `${duel.resultA.totalRings} Ringe`
                    : `RT ${(duel.resultA.ringteiler ?? 0).toFixed(1)}`}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {isDraw ? (
                    <>
                      <span className="hidden sm:inline">Unentschieden</span>
                      <span className="sm:hidden">=</span>
                    </>
                  ) : isWinnerA ? (
                    "▸"
                  ) : (
                    "◂"
                  )}
                </span>
                <span
                  className={`min-w-0 flex-1 overflow-hidden tabular-nums ${isWinnerB ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {isFinal
                    ? `${duel.resultB.totalRings} Ringe`
                    : `RT ${(duel.resultB.ringteiler ?? 0).toFixed(1)}`}
                </span>
                {canManage && match.canCorrect && (
                  <>
                    <PlayoffDuelResultDialog
                      duel={duel}
                      participantA={match.participantA}
                      participantB={match.participantB}
                      isCorrection={true}
                      isFinalMatch={isFinal}
                      scoringType={scoringType}
                      shotsPerSeries={shotsPerSeries}
                      finalePrimary={finalePrimary}
                      finaleTiebreaker1={finaleTiebreaker1}
                      finaleTiebreaker2={finaleTiebreaker2}
                    />
                    {duel.id === lastDuelId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDuelId(duel.id)}
                        disabled={submitting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <span className="flex-1" />
                {canManage && duel.id === nextPendingDuel?.id && (
                  <>
                    <PlayoffDuelResultDialog
                      duel={duel}
                      participantA={match.participantA}
                      participantB={match.participantB}
                      isCorrection={false}
                      isFinalMatch={isFinal}
                      scoringType={scoringType}
                      shotsPerSeries={shotsPerSeries}
                      finalePrimary={finalePrimary}
                      finaleTiebreaker1={finaleTiebreaker1}
                      finaleTiebreaker2={finaleTiebreaker2}
                    />
                    {match.canCorrect && duel.id === lastDuelId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => setConfirmDuelId(duel.id)}
                        disabled={submitting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
