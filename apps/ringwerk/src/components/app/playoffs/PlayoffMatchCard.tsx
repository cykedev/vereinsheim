"use client"

import { Plus, Trophy } from "lucide-react"
import { Badge } from "@vereinsheim/ui/badge"
import { Button } from "@vereinsheim/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/card"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import {
  DeleteDuelConfirm,
  DuelRows,
  finaleHintText,
  ROUND_LABEL,
  usePlayoffMatchCard,
  WINNER_BADGE,
  type PlayoffCardConfig,
} from "./playoff-match-card"

interface Props {
  match: PlayoffMatchItem
  canManage: boolean
  config: PlayoffCardConfig
}

export function PlayoffMatchCard({ match, canManage, config }: Props) {
  const { shotsPerSeries, playoffBestOf, finalePrimary, finaleTiebreaker1, finaleTiebreaker2 } =
    config
  const card = usePlayoffMatchCard({ match, canManage, playoffBestOf })
  const {
    requiredWins,
    bestOfLabel,
    submitting,
    confirmDuelId,
    setConfirmDuelId,
    isFinal,
    isCompleted,
    winnerId,
    canAddDuel,
    handleAddDuel,
    handleDeleteDuel,
    nameA,
    nameB,
  } = card

  return (
    <>
      <DeleteDuelConfirm
        open={!!confirmDuelId}
        onOpenChange={(open) => !open && setConfirmDuelId(null)}
        onConfirm={handleDeleteDuel}
      />
      <Card className={isCompleted ? "border-muted" : ""}>
        <CardHeader className="px-4 pb-2 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ROUND_LABEL[match.round]}
            </CardTitle>
            {isCompleted && winnerId && (
              <Badge
                variant="outline"
                className={`gap-1 text-xs ${WINNER_BADGE[match.round] ?? ""}`}
              >
                <Trophy className="h-3 w-3" />
                {winnerId === match.participantA.id ? nameA : nameB}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 sm:px-6">
          {/* Stand */}
          <div className="flex items-center gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-sm font-medium ${winnerId === match.participantA.id ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {nameA}
            </span>
            <span className="shrink-0 tabular-nums text-lg font-bold">
              {match.winsA} : {match.winsB}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-right text-sm font-medium ${winnerId === match.participantB.id ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {nameB}
            </span>
          </div>

          <DuelRows match={match} canManage={canManage} config={config} card={card} />

          {/* Duell anlegen */}
          {canAddDuel && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleAddDuel}
              disabled={submitting}
            >
              <Plus className="mr-1 h-3 w-3" />
              {submitting
                ? "Anlegen…"
                : isFinal
                  ? `${shotsPerSeries} Schüsse anlegen`
                  : match.duels.length === 0
                    ? "Erstes Duell anlegen"
                    : "Nächstes Duell anlegen"}
            </Button>
          )}

          {/* Hinweis */}
          {!isCompleted &&
            (isFinal ? (
              <p className="text-center text-xs text-muted-foreground">
                {finaleHintText(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)} · bei
                Gleichstand Verlängerung
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {bestOfLabel} · noch {requiredWins - Math.max(match.winsA, match.winsB)} Siege zum
                Weiterkommen
              </p>
            ))}
        </CardContent>
      </Card>
    </>
  )
}
