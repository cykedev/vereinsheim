"use client"

import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { PlayoffDuelItem, PlayoffParticipant } from "@/lib/playoffs/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { ParticipantResultFields, usePlayoffDuelResult } from "./duel-result"

interface Props {
  duel: PlayoffDuelItem
  participantA: PlayoffParticipant
  participantB: PlayoffParticipant
  isCorrection: boolean
  isFinalMatch: boolean
  scoringType: ScoringType
  shotsPerSeries: number
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
}

export function PlayoffDuelResultDialog({
  duel,
  participantA,
  participantB,
  isCorrection,
  isFinalMatch,
  scoringType,
  shotsPerSeries,
  finalePrimary,
  finaleTiebreaker1,
  finaleTiebreaker2,
}: Props) {
  const {
    showTeiler,
    open,
    setOpen,
    submitting,
    error,
    fieldA,
    setFieldA,
    fieldB,
    setFieldB,
    handleOpen,
    handleSubmit,
    title,
  } = usePlayoffDuelResult({
    duel,
    isCorrection,
    isFinalMatch,
    shotsPerSeries,
    finalePrimary,
    finaleTiebreaker1,
    finaleTiebreaker2,
  })

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 shrink-0 px-1.5 text-xs sm:px-2">
            <Plus className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Eintragen</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <ParticipantResultFields
            idPrefix="a"
            name={`${participantA.firstName} ${participantA.lastName}`}
            fields={fieldA}
            setFields={setFieldA}
            showTeiler={showTeiler}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            submitting={submitting}
          />

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">vs.</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <ParticipantResultFields
            idPrefix="b"
            name={`${participantB.firstName} ${participantB.lastName}`}
            fields={fieldB}
            setFields={setFieldB}
            showTeiler={showTeiler}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            submitting={submitting}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
