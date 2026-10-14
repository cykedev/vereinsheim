"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import type { CardMark, MarkShot } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { groupView } from "@vereinsheim/shot-ui/geometry"
import { MiniTarget } from "@vereinsheim/shot-ui/target/MiniTarget"
import { Button } from "@vereinsheim/ui/button"
import { ConfirmDialog } from "@vereinsheim/ui/shell/ConfirmDialog"

import { Page } from "@/components/shell/Page"
import { confirmFirstCard, rejectFirstCard } from "@/lib/first-card-actions"
import { marksById } from "@/lib/marks"
import type { PendingItem } from "@/lib/open"

const scheiben = (n: number) => (n === 1 ? "1 weitere Scheibe" : `${n} weitere Scheiben`)

/**
 * „Offen“ (SP-1.7 a2, D3): je SportpassID die älteste wartende Scheibe mit „Ja, meine“ und „Nicht meine“. Erst danach
 * stehen die Scheiben in Start, Liste und Fortschritt.
 */
export function OpenScreen({
  items,
  marks: compact,
}: {
  items: PendingItem[]
  /** die Lagen der gezeigten Scheiben, kompakt nach Id */
  marks: Record<string, CardMark[]>
}) {
  const marks = useMemo(() => marksById(compact), [compact])
  return (
    <Page>
      <section data-open-page className="grid max-w-2xl gap-4">
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Offen
          </h1>
          <p className="text-foreground-2">
            Die erste Scheibe unter deiner SportpassID: Ist sie deine? Erst danach erscheinen deine
            Scheiben in Start, Liste und Fortschritt.
          </p>
        </div>
        {items.length ? (
          <ul className="grid gap-3">
            {items.map((item) => (
              <PendingCard key={item.cardId} item={item} marks={marks.get(item.cardId) ?? []} />
            ))}
          </ul>
        ) : (
          <p
            data-open-empty
            className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground-2"
          >
            Nichts offen.
          </p>
        )}
      </section>
    </Page>
  )
}

function PendingCard({ item, marks }: { item: PendingItem; marks: MarkShot[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const target = TARGETS[item.targetId ?? "lp-10m"]
  const run = (action: (cardId: string) => ReturnType<typeof confirmFirstCard>) =>
    startTransition(async () => {
      setError(null)
      const result = await action(item.cardId)
      if ("error" in result) setError(getErrorMessage(result) ?? null)
      else router.refresh()
    })
  const facts = [
    item.stand ? `Stand ${item.stand}` : null,
    item.family,
    `${item.shots} Schuss`,
    item.result,
  ].filter(Boolean)

  return (
    <li
      data-pending-card={item.cardId}
      className="grid gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center gap-3">
        {item.targetId && marks.length ? (
          <MiniTarget
            target={target}
            view={groupView(target, marks)}
            shots={marks}
            className="size-14 shrink-0"
          />
        ) : null}
        <div className="grid min-w-0">
          <span className="text-[15px] font-semibold">{item.when}</span>
          <span className="text-[13px] text-muted-foreground">{facts.join(" · ")}</span>
          {item.more > 0 && (
            <span className="text-[13px] text-muted-foreground">
              und {scheiben(item.more)} unter dieser SportpassID
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10"
          disabled={pending}
          onClick={() => run(confirmFirstCard)}
        >
          Ja, meine
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-destructive"
          disabled={pending}
          onClick={() => setOpen(true)}
        >
          Nicht meine
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Nicht deine Scheibe?"
        description={
          item.more > 0
            ? `Diese und ${scheiben(item.more)} unter derselben SportpassID werden entfernt und kommen nicht wieder. Die SportpassID prüft dann ein Admin.`
            : "Die Scheibe wird entfernt und kommt nicht wieder. Die SportpassID prüft dann ein Admin."
        }
        confirmLabel="Nicht meine"
        destructive
        onConfirm={() => run(rejectFirstCard)}
      />
    </li>
  )
}
