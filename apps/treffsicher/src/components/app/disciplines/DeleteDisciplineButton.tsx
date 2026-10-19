"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog, type Decision } from "@vereinsheim/ui/design2/decision-dialog"
import { deleteDiscipline } from "@/lib/disciplines/actions"

type Props = {
  disciplineId: string
  /** die Folgen in Worten (`disciplineDelete`), von der Seite berechnet */
  decision: Decision
}

// Löschen gibt es nur für eine Disziplin ohne Einheiten und Abläufe; der Server prüft das noch einmal.
export function DeleteDisciplineButton({ disciplineId, decision }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function handleDelete(): void {
    setMessage(null)
    startTransition(async () => {
      const result = await deleteDiscipline(disciplineId)
      if ("error" in result) {
        setMessage(typeof result.error === "string" ? result.error : "Löschen fehlgeschlagen.")
        return
      }
      router.push("/disciplines")
    })
  }

  return (
    <div className="space-y-2">
      {message && <p className="text-sm text-destructive">{message}</p>}
      <Button
        variant="ghost"
        size="sm"
        className="px-2 text-destructive hover:text-destructive sm:px-3"
        disabled={isPending}
        aria-label={isPending ? "Löschen…" : "Disziplin löschen"}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4 sm:mr-1.5" />
        <span className="hidden sm:inline">{isPending ? "Löschen…" : "Löschen"}</span>
      </Button>
      <DecisionDialog
        decision={decision}
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleDelete}
      />
    </div>
  )
}
