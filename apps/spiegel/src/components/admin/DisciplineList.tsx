"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { cn } from "@vereinsheim/lib/utils"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { disciplineIgnore, disciplineShow } from "@/lib/admin/consequences"
import { setDisciplineIgnored } from "@/lib/admin/discipline-actions"
import { cardsText, statusChip, type DisciplineRow } from "@/lib/admin/discipline-model"

const LIST = "divide-y divide-border rounded-xl border border-border"

/** die Disziplinen in Abschnitten: neu, je Familie, ohne Familie, ignoriert (eingeklappt) */
export function DisciplineList({ rows }: { rows: readonly DisciplineRow[] }) {
  const fresh = rows.filter((r) => r.status === "waiting" || r.status === "suggested")
  const placed = rows.filter((r) => r.status === "confirmed")
  const ignored = rows.filter((r) => r.status === "ignored")
  const families = [...new Set(placed.flatMap((r) => (r.familyName ? [r.familyName] : [])))]
  const homeless = placed.filter((r) => r.familyId === null)
  return (
    <div className="grid gap-5">
      {fresh.length > 0 && (
        <Section title="Neu">
          {fresh.map((row) => (
            <DisciplineItem key={row.id} row={row} action="ignore" />
          ))}
        </Section>
      )}
      {families.map((family) => (
        <Section key={family} title={family}>
          {placed
            .filter((r) => r.familyName === family)
            .map((row) => (
              <DisciplineItem key={row.id} row={row} />
            ))}
        </Section>
      ))}
      {homeless.length > 0 && (
        <Section title="Ohne Familie">
          {homeless.map((row) => (
            <DisciplineItem key={row.id} row={row} />
          ))}
        </Section>
      )}
      {ignored.length > 0 && (
        <details className="grid gap-2" data-ignored>
          <summary className="cursor-pointer text-[13px] font-semibold text-foreground-2">
            Ignoriert ({ignored.length})
          </summary>
          <ul className={cn(LIST, "mt-2")}>
            {ignored.map((row) => (
              <DisciplineItem key={row.id} row={row} action="show" />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-[13px] font-semibold text-foreground-2">{title}</h2>
      <ul className={LIST}>{children}</ul>
    </section>
  )
}

/** eine Zeile: Name und Zahlen als Link aufs Blatt, daneben Zustand und je nach Abschnitt „Ignorieren“ oder „Wieder zeigen“ */
export function DisciplineItem({
  row,
  action,
}: {
  row: DisciplineRow
  action?: "ignore" | "show"
}) {
  const chip = statusChip(row)
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3" data-discipline={row.id}>
      <Link
        href={`/admin/disciplines/${row.id}`}
        className="grid min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="truncate text-[15px] font-semibold">{row.name}</span>
        <span className="text-[13px] text-muted-foreground">
          {row.meytonId === null ? "" : `Nummer ${row.meytonId} · `}
          {cardsText(row.stats.cards)}
        </span>
      </Link>
      {chip && (
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            row.status === "waiting"
              ? "bg-warning-wash text-warning"
              : "bg-surface-2 text-foreground-2"
          )}
        >
          {chip}
        </span>
      )}
      {action && <IgnoreButton row={row} ignore={action === "ignore"} />}
    </li>
  )
}

/** „Ignorieren“ bzw. „Wieder zeigen“ mit Dialog; nach dem Speichern liest die Seite neu */
export function IgnoreButton({
  row,
  ignore,
  onDone,
}: {
  row: DisciplineRow
  ignore: boolean
  onDone?: () => void
}) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const decision = ignore
    ? disciplineIgnore({ name: row.name, cards: row.stats.cards })
    : disciplineShow({
        name: row.name,
        cards: row.stats.cards,
        visible: row.targetId !== null && row.familyId !== null,
      })
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-10"
        disabled={pending}
        onClick={() => setAsking(true)}
      >
        {ignore ? "Ignorieren" : "Wieder zeigen"}
      </Button>
      {error && (
        <span role="alert" className="basis-full text-[13px] text-destructive">
          {error}
        </span>
      )}
      <DecisionDialog
        decision={decision}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          startTransition(async () => {
            const result = await setDisciplineIgnored(row.id, ignore)
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else {
              setError(null)
              if (onDone) onDone()
              else router.refresh()
            }
          })
        }
      />
    </>
  )
}
