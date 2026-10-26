"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"

import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { useUndo } from "@vereinsheim/ui/design2/undo"
import { cardDelete } from "@/lib/admin/consequences"
import { deleteCard, restoreCard } from "@/lib/trash-actions"

import { ActionRow } from "./ActionRow"

/**
 * Löschen als Zeile im Kasten „Diese Scheibe“: sagt, wohin die Scheibe geht, fragt mit Folgen, legt sie in den
 * Papierkorb, geht den Rückweg und zeigt dort „Scheibe gelöscht · Rückgängig“.
 */
export function DeleteCard({
  cardId,
  when,
  back,
  shared,
}: {
  cardId: string
  when: string
  back: string
  /** die Scheibe ist geteilt: die Rückfrage sagt, dass der Link danach nicht mehr geht */
  shared: boolean
}) {
  const router = useRouter()
  const showUndo = useUndo()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <ActionRow
      data-delete-card
      title="Löschen"
      state="Danach liegt die Scheibe 30 Tage im Papierkorb im Profil."
      action={
        <button
          type="button"
          aria-label="Scheibe löschen"
          disabled={pending}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          <Trash2 aria-hidden className="size-4" />
          {pending ? "Löschen…" : "Löschen"}
        </button>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={cardDelete({ evening: when, shared })}
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
    </ActionRow>
  )
}
