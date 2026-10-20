"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { seasonSeriesDelete } from "@/lib/consequences"
import { deleteSeasonSeries } from "@/lib/series/actions"

interface Props {
  seriesId: string
  competitionId: string
  name: string
  /** Tag der Serie im Anzeigeformat */
  date: string
  /** Mindestzahl an Serien für einen Platz, `null` ohne */
  minSeries: number | null
}

export function DeleteSeasonSeriesButton({
  seriesId,
  competitionId,
  name,
  date,
  minSeries,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSeasonSeries(seriesId, competitionId)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        toast.success("Serie gelöscht.")
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-destructive hover:text-destructive"
        title="Serie löschen"
        aria-label="Serie löschen"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <DecisionDialog
        decision={seasonSeriesDelete({ name, date, minSeries })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleDelete}
        confirmDisabled={isPending}
      />
    </>
  )
}
