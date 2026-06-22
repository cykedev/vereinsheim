"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@vereinsheim/ui/dialog"
import type { MatchResultSummary, MatchupParticipant } from "@/lib/matchups/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import {
  DeleteDuelConfirm,
  DuelInputPanels,
  EntryTriggerButton,
  RecordedDuelsList,
  RunningScore,
  useBestOfEntry,
} from "./best-of-entry"

interface Props {
  matchupId: string
  homeParticipant: MatchupParticipant
  awayParticipant: MatchupParticipant
  series: MatchResultSummary[]
  canManage: boolean
  /** True when at least one duel has been recorded (shows edit icon instead of plus). */
  hasResults: boolean
  // Competition best-of config
  scoringMode: ScoringMode
  /** null = mixed (per-participant discipline applies) */
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
  shotsPerSeries: number
  scoringType: ScoringType
  teilerFaktor: number
}

export function BestOfEntryDialog({
  matchupId,
  homeParticipant,
  awayParticipant,
  series,
  canManage,
  hasResults,
  scoringMode,
  disciplineId,
  groupBestOf,
  groupPlayAllDuels,
  groupTiebreaker1,
  groupTiebreaker2,
  shotsPerSeries,
  scoringType,
  teilerFaktor,
}: Props) {
  const entry = useBestOfEntry({
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
  })

  const {
    open,
    setOpen,
    confirmDelete,
    setConfirmDelete,
    isPending,
    error,
    homeId,
    awayId,
    homeName,
    awayName,
    homeWins,
    awayWins,
    duelNumbers,
    stechschussNumbers,
    isComplete,
    winnerId,
    handleOpenChange,
    handleDeleteLatest,
  } = entry

  if (!canManage) return null

  return (
    <>
      {/* Delete confirmation — rendered outside the main Dialog to avoid nesting issues */}
      <DeleteDuelConfirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={handleDeleteLatest}
      />

      <EntryTriggerButton hasResults={hasResults} onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {homeName} – {awayName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <RunningScore
              homeId={homeId}
              awayId={awayId}
              homeName={homeName}
              awayName={awayName}
              homeWins={homeWins}
              awayWins={awayWins}
              winnerId={winnerId}
            />

            <RecordedDuelsList
              homeId={homeId}
              awayId={awayId}
              series={series}
              duelNumbers={duelNumbers}
              stechschussNumbers={stechschussNumbers}
              disciplineId={disciplineId}
              scoringMode={scoringMode}
              scoringType={scoringType}
              groupTiebreaker1={groupTiebreaker1}
              groupTiebreaker2={groupTiebreaker2}
            />

            <DuelInputPanels
              entry={entry}
              scoringType={scoringType}
              shotsPerSeries={shotsPerSeries}
              teilerFaktor={teilerFaktor}
              disciplineId={disciplineId}
            />

            {/* Complete — no further input, undo available */}
            {isComplete && duelNumbers.length === 0 && stechschussNumbers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Keine Duelle erfasst.</p>
            )}

            {error && isComplete && <p className="text-sm text-destructive">{error}</p>}

            {/* Progress hint */}
            {!isComplete && (
              <p className="text-center text-xs text-muted-foreground">
                Best-of-{groupBestOf} · Siegerstand {Math.ceil(groupBestOf / 2)}
                {groupPlayAllDuels ? " · alle Duelle werden ausgetragen" : ""}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            {/* Undo button — only shown when there is something to undo */}
            <div>
              {(duelNumbers.length > 0 || stechschussNumbers.length > 0) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive/70 hover:text-destructive"
                  title="Letztes Duell/Stechschuss zurücknehmen"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
