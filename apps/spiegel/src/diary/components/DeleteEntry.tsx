"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { useUndo } from "@vereinsheim/ui/design2/undo"

import { ActionRow } from "@/components/card/ActionRow"

import { diaryEntryDelete } from "../consequences"
import { ENTRY_TEXTS, ERRORS } from "../texts"
import { deleteEntryAction, restoreEntryAction } from "../trash-actions"

/**
 * Löschen als Zeile im Kasten „Dieser Eintrag“, wie bei einer Scheibe: fragt mit Folgen, legt den Eintrag in den
 * Papierkorb, geht zurück ins Tagebuch und zeigt dort „Eintrag gelöscht · Rückgängig“.
 */
export function DeleteEntry({
  entryId,
  day,
  family,
}: {
  entryId: string
  day: string
  family: string | null
}) {
  const router = useRouter()
  const showUndo = useUndo()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <ActionRow
      data-delete-entry
      title={ENTRY_TEXTS.remove}
      state={ENTRY_TEXTS.removeState}
      action={
        <button
          type="button"
          aria-label="Eintrag löschen"
          disabled={pending}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
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
        decision={diaryEntryDelete({ day, family })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const result = await deleteEntryAction(entryId)
            if ("error" in result) {
              setError(getErrorMessage(result) ?? ERRORS.failed)
              return
            }
            showUndo({
              text: "Eintrag gelöscht",
              undo: () => restoreEntryAction(entryId),
              navigating: true,
            })
            router.replace("/diary")
          })
        }
      />
    </ActionRow>
  )
}
