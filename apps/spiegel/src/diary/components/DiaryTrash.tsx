"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import type { ActionResult } from "@/lib/types"

import { diaryEntryPurgeNow, goalPurgeNow, routinePurgeNow, type Decision } from "../consequences"
import { purgeGoalNowAction, restoreGoalAction } from "../goals/actions"
import { GOAL_TEXTS } from "../goals/texts"
import { purgeRoutineNowAction, restoreRoutineAction } from "../routines/actions"
import { ROUTINE_TEXTS } from "../routines/texts"
import { ERRORS } from "../texts"
import type { DiaryTrashItem, DiaryTrashThing } from "../trash"
import { purgeEntryNowAction, restoreEntryAction } from "../trash-actions"

/**
 * Abschnitt „Im Tagebuch“ im Papierkorb: Einträge, Ziele und Abläufe, gebaut wie die Zeilen der Scheiben, je mit
 * „Wiederherstellen“ und „Endgültig löschen“
 */
export function DiaryTrash({
  items,
  goals,
  routines,
}: {
  items: DiaryTrashItem[]
  goals: DiaryTrashThing[]
  routines: DiaryTrashThing[]
}) {
  if (!items.length && !goals.length && !routines.length) return null
  return (
    <section data-diary-trash aria-labelledby="diary-trash-title" className="grid gap-3">
      <h2 id="diary-trash-title" className="text-[13px] font-semibold text-muted-foreground">
        Im Tagebuch
      </h2>
      <ul className="grid gap-3">
        {items.map((item) => (
          <TrashRow
            key={item.entryId}
            kind="entry"
            title={item.day}
            facts={item.facts}
            left={item.left}
            restore={() => restoreEntryAction(item.entryId)}
            purge={() => purgeEntryNowAction(item.entryId)}
            decision={diaryEntryPurgeNow({ day: item.day })}
          />
        ))}
        {goals.map((goal) => (
          <TrashRow
            key={goal.id}
            kind="goal"
            title={goal.name}
            facts={GOAL_TEXTS.trashKind}
            left={goal.left}
            restore={() => restoreGoalAction(goal.id)}
            purge={() => purgeGoalNowAction(goal.id)}
            decision={goalPurgeNow({ title: goal.name })}
          />
        ))}
        {routines.map((routine) => (
          <TrashRow
            key={routine.id}
            kind="routine"
            title={routine.name}
            facts={ROUTINE_TEXTS.trashKind}
            left={routine.left}
            restore={() => restoreRoutineAction(routine.id)}
            purge={() => purgeRoutineNowAction(routine.id)}
            decision={routinePurgeNow({ name: routine.name })}
          />
        ))}
      </ul>
    </section>
  )
}

function TrashRow({
  kind,
  title,
  facts,
  left,
  restore,
  purge,
  decision,
}: {
  kind: "entry" | "goal" | "routine"
  title: string
  facts: string
  left: string
  restore: () => Promise<ActionResult>
  purge: () => Promise<ActionResult>
  decision: Decision
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null)
      const result = await action()
      if ("error" in result) {
        setError(getErrorMessage(result) ?? ERRORS.failed)
        return
      }
      router.refresh()
    })
  return (
    <li data-trash-entry={kind} className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid min-w-0">
        <span className="text-[15px] font-semibold">{title}</span>
        {facts && <span className="text-[13px] text-muted-foreground">{facts}</span>}
        <span className="text-[13px] text-muted-foreground">{left}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-10" disabled={pending} onClick={() => run(restore)}>
          Wiederherstellen
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-destructive"
          disabled={pending}
          onClick={() => setOpen(true)}
        >
          Endgültig löschen
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={decision}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => run(purge)}
      />
    </li>
  )
}
