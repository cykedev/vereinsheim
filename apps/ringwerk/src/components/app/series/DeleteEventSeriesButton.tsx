"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { eventSeriesDelete } from "@/lib/consequences"
import { deleteEventSeries } from "@/lib/series/actions"

interface Props {
  seriesId: string
  competitionId: string
  /** wie in der Liste: bei Gästen nur der Vorname */
  name: string
  /** im Team: auch die Teamwertung rechnet ohne das Ergebnis */
  teams: boolean
}

export function DeleteEventSeriesButton({ seriesId, competitionId, name, teams }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEventSeries(seriesId, competitionId)
      if ("error" in result && typeof result.error === "string") {
        toast.error(result.error)
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-destructive hover:text-destructive"
        title="Ergebnis löschen"
        aria-label="Ergebnis löschen"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <DecisionDialog
        decision={eventSeriesDelete({ name, teams })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleDelete}
        confirmDisabled={isPending}
      />
    </>
  )
}
