"use client"

import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"

import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Page } from "@vereinsheim/ui/design2/page"
import { cardPurgeNow } from "@/lib/admin/consequences"
import { purgeCardNow, restoreCard } from "@/lib/trash-actions"
import type { BlockedItem, TrashItem } from "@/lib/trash-view"

/**
 * Papierkorb: gelöschte Scheiben 30 Tage mit „Wiederherstellen“ und „Endgültig löschen“, darunter, was nicht
 * von selbst wiederkommt (endgültig gelöscht, als „nicht meine“ gemeldet), ohne Knopf.
 */
export function TrashScreen({ items, blocked }: { items: TrashItem[]; blocked: BlockedItem[] }) {
  return (
    <Page>
      <section data-trash-page className="grid max-w-2xl gap-6">
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Papierkorb
          </h1>
          <p className="text-foreground-2">
            Gelöschte Scheiben liegen hier 30 Tage und zählen nirgends mit. Danach werden sie
            endgültig gelöscht.
          </p>
        </div>

        {items.length ? (
          <ul className="grid gap-3">
            {items.map((item) => (
              <TrashRow key={item.cardId} item={item} />
            ))}
          </ul>
        ) : (
          <div data-trash-empty className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-bold tracking-tight">
              Der Papierkorb ist leer
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Eine Scheibe löschst du auf ihrer Seite, ganz unten.
            </p>
          </div>
        )}

        {blocked.length > 0 && (
          <div
            data-trash-blocked
            className="grid gap-2 rounded-2xl border border-border bg-card p-4"
          >
            <h2 className="text-[15px] font-semibold">Kommt nicht von selbst wieder</h2>
            <p className="text-sm text-foreground-2">
              Diese Scheiben holt Spiegel nicht mehr. Zurückgewiesene („nicht meine“) kann ein Admin
              wieder zulassen, solange die Nummer in deinem Profil steht.
            </p>
            <ul className="grid gap-1">
              {blocked.map((b) => (
                <li key={b.key} className="text-sm">
                  <span className="font-semibold">{b.when}</span>
                  <span className="text-muted-foreground"> · {b.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </Page>
  )
}

function TrashRow({ item }: { item: TrashItem }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const run = (action: (cardId: string) => ReturnType<typeof restoreCard>) =>
    startTransition(async () => {
      setError(null)
      const result = await action(item.cardId)
      if ("error" in result) setError(getErrorMessage(result) ?? "Das ließ sich nicht speichern.")
    })
  const facts = [item.family, item.result].filter(Boolean)

  return (
    <li data-trash-card className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid min-w-0">
        <span className="text-[15px] font-semibold">{item.when}</span>
        {facts.length > 0 && (
          <span className="text-[13px] text-muted-foreground">{facts.join(" · ")}</span>
        )}
        <span className="text-[13px] text-muted-foreground">{item.left}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-10" disabled={pending} onClick={() => run(restoreCard)}>
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
        decision={cardPurgeNow({ evening: item.when })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => run(purgeCardNow)}
      />
    </li>
  )
}
