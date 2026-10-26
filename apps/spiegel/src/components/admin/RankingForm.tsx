"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { rankingKind, type RankingChoice } from "@/lib/admin/consequences"
import type { RankingRow } from "@/lib/admin/rankings"
import { setRankingKind } from "@/lib/admin/site-actions"

import { AdminHelp } from "./AdminHelp"
import { rankingFacts } from "./RankingList"

const RANKING_OPTIONS = [
  { value: "open", label: "Nicht festgelegt" },
  { value: "training", label: "Training" },
  { value: "competition", label: "Wettkampf" },
] as const

/**
 * Blatt einer Liste aus Meyton (`Ranking`), gebaut wie das Blatt einer Disziplin: die Art wählen, „Übernehmen“ fragt
 * erst mit den Folgen (`DecisionDialog`), weil eine Wahl alle Scheiben der Liste umstellt; danach zurück zu den Listen.
 */
export function RankingForm({ row }: { row: RankingRow }) {
  const router = useRouter()
  const saved: RankingChoice = row.kind ?? "open"
  const [kind, setKind] = useState<RankingChoice>(saved)
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending || kind === saved) return
    setAsking(true)
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {row.name}
        </h1>
        <p className="text-[13px] text-muted-foreground">{rankingFacts(row)}</p>
      </div>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-1 text-[15px] font-semibold">
          Art der Liste <AdminHelp id="ranking" />
        </h2>
        <Segmented
          label="Art der Liste"
          options={RANKING_OPTIONS}
          value={kind}
          onChange={setKind}
          wrap
        />
      </section>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" className="h-10" disabled={pending || kind === saved}>
          {pending ? "Speichern…" : "Übernehmen"}
        </Button>
      </div>
      <DecisionDialog
        decision={rankingKind({ ranking: row.name, cards: row.cards, kind })}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          startTransition(async () => {
            const result = await setRankingKind(row.id, kind)
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else router.push("/admin/lists")
          })
        }
      />
    </form>
  )
}
