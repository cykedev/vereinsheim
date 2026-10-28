"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import type { ActionResult } from "@/lib/types"

import { diaryEntryPurgeNow } from "../consequences"
import { ERRORS } from "../texts"
import type { DiaryTrashItem } from "../trash"
import { purgeEntryNowAction, restoreEntryAction } from "../trash-actions"

/** Abschnitt „Einträge im Tagebuch“ im Papierkorb, gebaut wie die Zeilen der Scheiben */
export function DiaryTrash({ items }: { items: DiaryTrashItem[] }) {
  if (!items.length) return null
  return (
    <section data-diary-trash aria-labelledby="diary-trash-title" className="grid gap-3">
      <h2 id="diary-trash-title" className="text-[13px] font-semibold text-muted-foreground">
        Einträge im Tagebuch
      </h2>
      <ul className="grid gap-3">
        {items.map((item) => (
          <TrashEntry key={item.entryId} item={item} />
        ))}
      </ul>
    </section>
  )
}

function TrashEntry({ item }: { item: DiaryTrashItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const run = (action: (id: string) => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null)
      const result = await action(item.entryId)
      if ("error" in result) {
        setError(getErrorMessage(result) ?? ERRORS.failed)
        return
      }
      router.refresh()
    })
  return (
    <li data-trash-entry className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid min-w-0">
        <span className="text-[15px] font-semibold">{item.day}</span>
        {item.facts && <span className="text-[13px] text-muted-foreground">{item.facts}</span>}
        <span className="text-[13px] text-muted-foreground">{item.left}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10"
          disabled={pending}
          onClick={() => run(restoreEntryAction)}
        >
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
        decision={diaryEntryPurgeNow({ day: item.day })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => run(purgeEntryNowAction)}
      />
    </li>
  )
}
