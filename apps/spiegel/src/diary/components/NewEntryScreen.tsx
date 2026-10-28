"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { formatTimeOfDay } from "@vereinsheim/lib/format"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { cn } from "@vereinsheim/lib/utils"
import { markShots, type CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { MiniTarget } from "@vereinsheim/shot-ui/target/MiniTarget"
import { Page } from "@vereinsheim/ui/design2/page"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

import type { ResultCard } from "@/lib/results-read"
import type { ActionResult } from "@/lib/types"

import { createEntryFromEvening, createEntryWithout } from "../actions"
import type { Proposal } from "../proposals"
import type { Family } from "../queries"
import { dayLabel } from "../summaries"
import { ENTRY_TEXTS, ERRORS, KIND_CHOICES, NEW_TEXTS } from "../texts"

const PRIMARY =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
const QUIET =
  "inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
const FIELD =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"

/**
 * „Neuer Eintrag“: je Abend und Disziplin der letzten 30 Tage mit Scheiben ohne Eintrag ein Vorschlag (der jüngste oder
 * der aus der Adresse mit gefülltem Knopf), darunter ein Eintrag ohne Scheibe. Anlegen öffnet den Eintrag.
 */
export function NewEntryScreen({
  proposals,
  marks,
  families,
  today,
  timeZone,
}: {
  proposals: Proposal<ResultCard>[]
  marks: Record<string, CardMark[]>
  families: Family[]
  today: string
  timeZone: string
}) {
  const router = useRouter()
  const [form, setForm] = useState<{
    day: string
    kind: "shooting" | "dry" | "mental"
    familyId: number | null
  }>({
    day: today,
    kind: "shooting",
    familyId: families[0]?.id ?? null,
  })
  const [error, setError] = useState<{ where: string; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const create = (where: string, action: () => Promise<ActionResult<{ id: string }>>) =>
    startTransition(async () => {
      setError(null)
      const result = await action()
      if ("error" in result) {
        setError({ where, text: getErrorMessage(result) ?? ERRORS.failed })
        return
      }
      toast.success(NEW_TEXTS.created)
      router.push(`/diary/${result.data!.id}`)
    })
  const primaryIndex = Math.max(
    0,
    proposals.findIndex((p) => p.marked)
  )
  const time = (card: ResultCard) =>
    card.timeUnknown ? "Uhrzeit unbekannt" : formatTimeOfDay(new Date(card.startedAtMs), timeZone)

  return (
    <Page>
      <section data-new-entry className={cn("grid gap-6", PAGE_SINGLE)}>
        <Link
          href="/diary"
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {ENTRY_TEXTS.back}
        </Link>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            {NEW_TEXTS.title}
          </h1>
          <p className="text-foreground-2">{NEW_TEXTS.lead}</p>
        </div>

        <section aria-labelledby="evenings-title" className="grid gap-3">
          <h2 id="evenings-title" className="text-[15px] font-semibold">
            {NEW_TEXTS.evenings}
          </h2>
          {proposals.length === 0 && (
            <p className="text-sm text-muted-foreground">{NEW_TEXTS.none}</p>
          )}
          <ul className="grid gap-3">
            {proposals.map((proposal, i) => {
              const key = `${proposal.day}|${proposal.family.id}`
              const cards = proposal.cards
              return (
                <li
                  key={key}
                  data-proposal={key}
                  data-marked={proposal.marked || undefined}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-card p-4",
                    i === primaryIndex ? "border-line-strong" : "border-border",
                    proposal.marked && "bg-accent-wash"
                  )}
                >
                  <span className="grid min-w-0 gap-2">
                    <span className="text-[15px] font-semibold">
                      {dayLabel(proposal.day, timeZone)}
                      <span className="font-normal text-foreground-2">{` · ${proposal.family.name}`}</span>
                    </span>
                    <span className="text-[13px] text-foreground-2 tabular-nums">
                      {cards.length === 1
                        ? `1 Scheibe · ${time(cards[0])}`
                        : `${cards.length} Scheiben · ${time(cards[0])} bis ${time(cards[cards.length - 1])}`}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {cards.map((card) => {
                        const shots = markShots(marks[card.id] ?? [])
                        return card.targetId ? (
                          <MiniTarget
                            key={card.id}
                            target={TARGETS[card.targetId]}
                            shots={shots}
                            placeholder={shots.length === 0}
                            className="size-10"
                          />
                        ) : null
                      })}
                    </span>
                    {error?.where === key && (
                      <span role="alert" className="text-sm text-destructive">
                        {error.text}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      create(key, () => createEntryFromEvening(proposal.day, proposal.family.id))
                    }
                    className={i === primaryIndex ? PRIMARY : QUIET}
                  >
                    {NEW_TEXTS.create}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <form
          data-new-without
          className="grid gap-4 rounded-2xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault()
            create("without", () => createEntryWithout(form))
          }}
        >
          <h2 className="text-[15px] font-semibold">{NEW_TEXTS.without}</h2>
          <label className="grid gap-1.5 text-sm font-semibold">
            {ENTRY_TEXTS.day}
            <input
              type="date"
              max={today}
              value={form.day}
              onChange={(event) => setForm({ ...form, day: event.target.value })}
              className={FIELD}
            />
          </label>
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold">{ENTRY_TEXTS.kind}</span>
            <Segmented
              label={ENTRY_TEXTS.kind}
              options={KIND_CHOICES}
              value={form.kind}
              onChange={(kind) => setForm({ ...form, kind })}
              wrap
            />
            {form.kind === "shooting" && (
              <span className="text-[13px] text-muted-foreground">{NEW_TEXTS.withCardsHint}</span>
            )}
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            {ENTRY_TEXTS.family}
            <select
              value={form.familyId ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  familyId: event.target.value ? Number(event.target.value) : null,
                })
              }
              className={FIELD}
            >
              {form.kind !== "shooting" && <option value="">{ENTRY_TEXTS.noFamily}</option>}
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          </label>
          {error?.where === "without" && (
            <p role="alert" className="text-sm text-destructive">
              {error.text}
            </p>
          )}
          <button type="submit" disabled={pending} className={cn(QUIET, "justify-self-start")}>
            {NEW_TEXTS.create}
          </button>
        </form>
      </section>
    </Page>
  )
}
