"use client"

import { ArrowLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { formatMonthYear, formatTimeOfDay, zonedDayStartMs } from "@vereinsheim/lib/format"
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
/** so viele Abende ohne Eintrag stehen zuerst, die übrigen hinter „Ältere Abende zeigen“ */
const FIRST = 5

/** Abende nach Monat, in der Folge der Liste (neueste zuerst) */
function groupByMonth(list: Proposal<ResultCard>[], timeZone: string) {
  const months = new Map<string, Proposal<ResultCard>[]>()
  for (const proposal of list) {
    const month = formatMonthYear(
      new Date(zonedDayStartMs(proposal.day, timeZone) + 12 * 3_600_000),
      timeZone
    )
    months.set(month, [...(months.get(month) ?? []), proposal])
  }
  return months
}

const FIELD =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"

/**
 * „Neuer Eintrag“: oben „Heute“ (Tag vorbelegt und änderbar, Art, Disziplin, ein Knopf), der Weg für Vorhaben und
 * Prognose vor dem Training; die Scheiben des Tages kommen von selbst dazu. Darunter jeder Abend mit Scheiben ohne
 * Eintrag, egal wie alt, als Karte, die ganz anlegt (die aus der Adresse hervorgehoben): die ersten fünf, die übrigen
 * hinter „Ältere Abende zeigen“ nach Monat. Anlegen öffnet den Eintrag.
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
    // die Disziplin des jüngsten Abends, sonst die erste
    familyId: proposals[0]?.family.id ?? families[0]?.id ?? null,
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
  // Zahl und Uhrzeiten nur der Scheiben mit bekannter Uhrzeit: „2 Scheiben · 19:17“, nicht „unbekannt bis 19:17“
  const cardsText = (cards: ResultCard[]) => {
    const times = cards
      .filter((card) => !card.timeUnknown)
      .map((card) => formatTimeOfDay(new Date(card.startedAtMs), timeZone))
    const count = cards.length === 1 ? "1 Scheibe" : `${cards.length} Scheiben`
    if (!times.length) return count
    return times.length === 1
      ? `${count} · ${times[0]}`
      : `${count} · ${times[0]} bis ${times[times.length - 1]}`
  }

  // die ersten Abende stehen offen; ist der aus der Adresse älter, sind alle offen
  const [showOlder, setShowOlder] = useState(() => proposals.findIndex((p) => p.marked) >= FIRST)
  const olderByMonth = [...groupByMonth(proposals.slice(FIRST), timeZone)]
  const evening = (proposal: Proposal<ResultCard>) => {
    const key = `${proposal.day}|${proposal.family.id}`
    const cards = proposal.cards
    const label = dayLabel(proposal.day, timeZone)
    return (
      <li key={key}>
        {/* die ganze Karte legt an (conventions §7), ohne eigenen Knopf */}
        <button
          type="button"
          data-proposal={key}
          data-marked={proposal.marked || undefined}
          disabled={pending}
          aria-label={NEW_TEXTS.createFor(label, proposal.family.name)}
          onClick={() =>
            create(key, () => createEntryFromEvening(proposal.day, proposal.family.id))
          }
          className={cn(
            "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
            proposal.marked ? "border-line-strong bg-accent-wash" : "border-border"
          )}
        >
          <span className="grid min-w-0 gap-2">
            <span className="text-[15px] font-semibold">
              {label}
              <span className="font-normal text-foreground-2">{` · ${proposal.family.name}`}</span>
            </span>
            <span className="text-[13px] text-foreground-2 tabular-nums">{cardsText(cards)}</span>
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
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
        </button>
        {error?.where === key && (
          <p role="alert" className="pt-1 text-sm text-destructive">
            {error.text}
          </p>
        )}
      </li>
    )
  }

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

        <form
          data-new-without
          aria-labelledby="today-title"
          className="grid gap-4 rounded-2xl border border-line-strong bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault()
            create("today", () => createEntryWithout(form))
          }}
        >
          <h2 id="today-title" className="text-[15px] font-semibold">
            {NEW_TEXTS.today}
          </h2>
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
          {form.kind === "shooting" && (
            <p className="text-[13px] text-muted-foreground">{NEW_TEXTS.withCardsHint}</p>
          )}
          {error?.where === "today" && (
            <p role="alert" className="text-sm text-destructive">
              {error.text}
            </p>
          )}
          <button type="submit" disabled={pending} className={cn(PRIMARY, "justify-self-start")}>
            {NEW_TEXTS.create}
          </button>
        </form>

        <section aria-labelledby="evenings-title" className="grid gap-3">
          <h2 id="evenings-title" className="text-[15px] font-semibold">
            {NEW_TEXTS.evenings}
          </h2>
          {proposals.length === 0 && (
            <p className="text-sm text-muted-foreground">{NEW_TEXTS.none}</p>
          )}
          <ul className="grid gap-3">{proposals.slice(0, FIRST).map(evening)}</ul>
          {proposals.length > FIRST &&
            (showOlder ? (
              olderByMonth.map(([month, list]) => (
                <section key={month} aria-label={month} className="grid gap-3 pt-2">
                  <h3 className="text-[13px] font-semibold text-muted-foreground">{month}</h3>
                  <ul className="grid gap-3">{list.map(evening)}</ul>
                </section>
              ))
            ) : (
              <button
                type="button"
                data-older-evenings
                onClick={() => setShowOlder(true)}
                className="inline-flex h-10 cursor-pointer items-center justify-self-start rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
              >
                {`${NEW_TEXTS.older} (${proposals.length - FIRST})`}
              </button>
            ))}
        </section>
      </section>
    </Page>
  )
}
