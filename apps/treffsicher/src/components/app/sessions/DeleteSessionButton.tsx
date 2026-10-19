"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog, type Decision } from "@vereinsheim/ui/design2/decision-dialog"
import { deleteSession } from "@/lib/sessions/actions"

interface Props {
  sessionId: string
  /** die Folgen in Worten (`sessionDelete`), von der Seite berechnet */
  decision: Decision
}

// Löscht eine Einheit, nachdem der Dialog die Folgen genannt hat.
export function DeleteSessionButton({ sessionId, decision }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function handleDelete(): void {
    setMessage(null)
    startTransition(async () => {
      const result = await deleteSession(sessionId)
      const error = getErrorMessage(result)
      if (error) {
        setMessage(error)
        return
      }
      router.push("/sessions")
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
        aria-label={isPending ? "Löschen…" : "Löschen"}
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
