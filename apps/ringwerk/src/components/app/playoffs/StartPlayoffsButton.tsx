"use client"

import { useState, useTransition } from "react"
import { Trophy } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { toast } from "sonner"
import { playoffsStart } from "@/lib/consequences"
import { startPlayoffs } from "@/lib/playoffs/actions"

interface Props {
  competitionId: string
  name: string
  /** erste Runde laut Einstellungen */
  round: "Achtelfinale" | "Viertelfinale" | "Halbfinale"
  /** aktive Teilnehmer in der Tabelle */
  active: number
  disabled?: boolean
  disabledReason?: string
}

export function StartPlayoffsButton({
  competitionId,
  name,
  round,
  active,
  disabled,
  disabledReason,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await startPlayoffs(competitionId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Starten der Playoffs."
        )
      }
    })
  }

  return (
    <div className="space-y-1">
      <Button disabled={isPending || disabled} onClick={() => setOpen(true)}>
        <Trophy className="mr-2 h-4 w-4" />
        {isPending ? "Starte…" : "Playoffs starten"}
      </Button>
      <DecisionDialog
        decision={playoffsStart({ name, round, active })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
      />
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  )
}
