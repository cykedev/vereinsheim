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
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { SeasonSeriesFormFields, useSeasonSeriesForm, type ExistingSeries } from "./season-series"

interface Props {
  competitionId: string
  participantId: string
  participantName: string
  scoringMode: ScoringMode
  shotsPerSeries: number
  /** Disziplinen für gemischte Saisons */
  disciplines?: { id: string; name: string; scoringType: ScoringType; teilerFaktor: number }[]
  defaultDisciplineId?: string | null
  /** Wenn gesetzt: Edit-Modus für diese bestehende Serie */
  existingSeries?: ExistingSeries
}

export function SeasonSeriesDialog({
  competitionId,
  participantId,
  participantName,
  scoringMode,
  shotsPerSeries,
  disciplines,
  defaultDisciplineId,
  existingSeries,
}: Props) {
  const form = useSeasonSeriesForm({
    competitionId,
    participantId,
    scoringMode,
    disciplines,
    defaultDisciplineId,
    existingSeries,
  })
  const { open, isCorrection, isPending, handleOpenChange } = form

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="icon" className="h-10 w-10" title="Serie bearbeiten">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-10 w-10" title="Serie hinzufügen">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Serie bearbeiten" : "Serie hinzufügen"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{participantName}</p>
        </DialogHeader>

        <SeasonSeriesFormFields
          form={form}
          shotsPerSeries={shotsPerSeries}
          disciplines={disciplines}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button type="submit" form="season-series-form" disabled={isPending}>
            {isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
