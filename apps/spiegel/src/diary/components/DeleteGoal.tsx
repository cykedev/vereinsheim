"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { useUndo } from "@vereinsheim/ui/design2/undo"

import { ActionRow } from "@/components/card/ActionRow"

import { goalDelete } from "../consequences"
import { deleteGoalAction, restoreGoalAction } from "../goals/actions"
import { GOAL_TEXTS } from "../goals/texts"
import { ERRORS } from "../texts"

/**
 * Löschen als Zeile im Kasten „Dieses Ziel“, wie bei einem Eintrag: fragt mit Folgen, legt das Ziel in den Papierkorb,
 * geht zurück zu den Zielen und zeigt dort „Ziel gelöscht · Rückgängig“.
 */
export function DeleteGoal({ goalId, title }: { goalId: string; title: string }) {
  const router = useRouter()
  const showUndo = useUndo()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <ActionRow
      data-delete-goal
      title={GOAL_TEXTS.remove}
      state={GOAL_TEXTS.removeState}
      action={
        <button
          type="button"
          aria-label={GOAL_TEXTS.removeLabel}
          disabled={pending}
          onClick={() => setOpen(true)}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        >
          <Trash2 aria-hidden className="size-4" />
          {pending ? "Löschen…" : GOAL_TEXTS.remove}
        </button>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={goalDelete({ title })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() =>
          startTransition(async () => {
            setError(null)
            const result = await deleteGoalAction(goalId)
            if ("error" in result) {
              setError(getErrorMessage(result) ?? ERRORS.failed)
              return
            }
            showUndo({
              text: GOAL_TEXTS.deleted,
              undo: () => restoreGoalAction(goalId),
              navigating: true,
            })
            router.replace("/diary/goals")
          })
        }
      />
    </ActionRow>
  )
}
