"use client"

import { useState, useActionState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RingsInput } from "@/components/app/series/RingsInput"
import { saveEventSeries } from "@/lib/series/actions"
import type { ActionResult } from "@/lib/types"
import type { ScoringType } from "@/generated/prisma/client"

interface Props {
  competitionId: string
  competitionParticipantId: string
  participantName: string
  scoringType: ScoringType
  shotsPerSeries: number
  /** Teiler-Korrekturfaktor der Disziplin — für Live-Anzeige des korrigierten Teilers */
  teilerFaktor?: number
  /** Vorhandene Serie — wenn gesetzt, Korrektur-Modus */
  existingSeries?: { rings: number; teiler: number }
}

export function EventSeriesDialog({
  competitionId,
  competitionParticipantId,
  participantName,
  scoringType,
  shotsPerSeries,
  teilerFaktor = 1,
  existingSeries,
}: Props) {
  const [open, setOpen] = useState(false)
  const isCorrection = !!existingSeries

  const [rings, setRings] = useState<string>(existingSeries ? String(existingSeries.rings) : "")
  const [teiler, setTeiler] = useState<string>(existingSeries ? String(existingSeries.teiler) : "")

  const boundAction = saveEventSeries.bind(null, competitionId, competitionParticipantId)
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await boundAction(prev, formData)
      if (result && "success" in result && result.success) {
        setOpen(false)
      }
      return result
    },
    null
  )

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setRings(existingSeries ? String(existingSeries.rings) : "")
      setTeiler(existingSeries ? String(existingSeries.teiler) : "")
    }
    setOpen(isOpen)
  }

  const teilerNum = parseFloat(teiler.replace(",", "."))
  const correctedTeiler = isNaN(teilerNum) || teilerFaktor === 1 ? null : teilerNum * teilerFaktor

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title={isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}
        >
          {isCorrection ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{participantName}</p>
        </DialogHeader>

        <form id="series-form" action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rings">Gesamtringe</Label>
            <RingsInput
              id="rings"
              name="rings"
              scoringType={scoringType}
              shotsPerSeries={shotsPerSeries}
              value={rings}
              onChange={(e) => setRings(e.target.value)}
              disabled={isPending}
              autoFocus
            />
            {fieldErrors?.rings && (
              <p className="text-sm text-destructive">{fieldErrors.rings[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teiler">Bester Teiler</Label>
            <Input
              id="teiler"
              name="teiler"
              type="text"
              inputMode="decimal"
              value={teiler}
              onChange={(e) => setTeiler(e.target.value)}
              placeholder="z.B. 3,7"
              disabled={isPending}
            />
            {fieldErrors?.teiler && (
              <p className="text-sm text-destructive">{fieldErrors.teiler[0]}</p>
            )}
            {correctedTeiler !== null && (
              <p className="text-xs text-muted-foreground">
                Korr. Teiler: {correctedTeiler.toFixed(2)}
              </p>
            )}
          </div>

          {generalError && <p className="text-sm text-destructive">{generalError}</p>}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Abbrechen
          </Button>
          <Button type="submit" form="series-form" disabled={isPending}>
            {isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
