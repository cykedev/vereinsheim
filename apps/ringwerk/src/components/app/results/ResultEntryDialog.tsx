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
import type { MatchResultSummary } from "@/lib/matchups/types"
import type { ScoringType } from "@/generated/prisma/client"
import { ResultFields, useResultEntry } from "./result-entry"

interface Props {
  matchupId: string
  homeName: string
  awayName: string
  homeParticipantId: string
  awayParticipantId: string
  /** Existierende Ergebnisse für Vorausfüllung bei Korrektur */
  existingResults: MatchResultSummary[]
  isCorrection: boolean
  /** ScoringType je Teilnehmer (kann bei gemischten Wettbewerben unterschiedlich sein) */
  homeScoringType: ScoringType
  awayScoringType: ScoringType
  shotsPerSeries: number
  homeTeilerFaktor: number
  awayTeilerFaktor: number
}

export function ResultEntryDialog({
  matchupId,
  homeName,
  awayName,
  homeParticipantId,
  awayParticipantId,
  existingResults,
  isCorrection,
  homeScoringType,
  awayScoringType,
  shotsPerSeries,
  homeTeilerFaktor,
  awayTeilerFaktor,
}: Props) {
  const {
    open,
    setOpen,
    isPending,
    error,
    home,
    setHome,
    away,
    setAway,
    handleOpen,
    handleSubmit,
  } = useResultEntry({ matchupId, homeParticipantId, awayParticipantId, existingResults })

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ergebnis korrigieren">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="h-7 w-7" title="Ergebnis eintragen">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <ResultFields
            idPrefix="home"
            name={homeName}
            fields={home}
            setFields={setHome}
            scoringType={homeScoringType}
            shotsPerSeries={shotsPerSeries}
            teilerFaktor={homeTeilerFaktor}
            teilerPlaceholder="z.B. 3,7"
          />

          {/* Trennlinie */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">vs.</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <ResultFields
            idPrefix="away"
            name={awayName}
            fields={away}
            setFields={setAway}
            scoringType={awayScoringType}
            shotsPerSeries={shotsPerSeries}
            teilerFaktor={awayTeilerFaktor}
            teilerPlaceholder="z.B. 5,0"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
