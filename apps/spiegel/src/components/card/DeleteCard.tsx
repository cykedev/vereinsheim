"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { useUndo } from "@/components/shell/UndoBar"
import { cardDelete } from "@/lib/admin/consequences"
import { deleteCard, restoreCard } from "@/lib/trash-actions"

/**
 * Löschen am Ende der Seite einer Scheibe: fragt mit Folgen, legt die Scheibe in den Papierkorb, geht den
 * Rückweg und zeigt dort „Scheibe gelöscht · Rückgängig“.
 */
export function DeleteCard({ cardId, when, back }: { cardId: string; when: string; back: string }) {
  const router = useRouter()
  const showUndo = useUndo()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <section data-delete-card aria-label="Löschen" className="grid justify-items-start gap-2 pt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
      >
        <Trash2 aria-hidden className="size-4" />
        {pending ? "Löschen…" : "Scheibe löschen"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={cardDelete({ evening: when })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const result = await deleteCard(cardId)
            if ("error" in result) {
              setError(getErrorMessage(result) ?? "Das ließ sich nicht löschen.")
              return
            }
            showUndo({
              text: "Scheibe gelöscht",
              undo: () => restoreCard(cardId),
              navigating: true,
            })
            router.replace(back)
          })
        }
      />
    </section>
  )
}
