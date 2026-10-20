"use client"

import { useState, useTransition } from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { toast } from "sonner"
import { nextRound } from "@/lib/consequences"
import { advanceRound } from "@/lib/playoffs/actions"

interface Props {
  competitionId: string
  /** die Runde, die angelegt wird */
  round: "Viertelfinale" | "Halbfinale" | "Finale"
  /** die Runde, deren Paarungen entschieden sind */
  previous: "Achtelfinale" | "Viertelfinale" | "Halbfinale"
}

export function AdvanceRoundButton({ competitionId, round, previous }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleAdvance() {
    startTransition(async () => {
      const result = await advanceRound(competitionId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Anlegen der Runde."
        )
      }
    })
  }

  return (
    <>
      <Button disabled={isPending} size="sm" onClick={() => setOpen(true)}>
        <ArrowRight className="mr-2 h-4 w-4" />
        {isPending ? "Anlegen…" : `${round} anlegen`}
      </Button>
      <DecisionDialog
        decision={nextRound({ round, previous })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleAdvance}
      />
    </>
  )
}
