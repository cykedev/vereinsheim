"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { formatTimeOfDay } from "@vereinsheim/lib/format"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { markShots, type CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { MiniTarget } from "@vereinsheim/shot-ui/target/MiniTarget"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import type { ResultCard } from "@/lib/results-read"
import type { ActionResult } from "@/lib/types"

import { addEntryCard, releaseEntryCard } from "../actions"
import { diaryCardRelease } from "../consequences"
import type { EntryCardView } from "../queries"
import { resultText } from "../summaries"
import { ENTRY_TEXTS, ERRORS } from "../texts"

const PILL =
  "inline-flex h-10 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-[13px] font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

const PROVENANCE: Partial<Record<ResultCard["provenance"], string>> = {
  printout: "vom Ausdruck",
  entered: "eingetragen",
}

/** Uhrzeit einer Scheibe wie in den Listen, ohne bekannte Uhrzeit „Uhrzeit unbekannt“ */
const timeOf = (card: ResultCard, timeZone: string) =>
  card.timeUnknown ? "Uhrzeit unbekannt" : formatTimeOfDay(new Date(card.startedAtMs), timeZone)

/**
 * Die Scheiben eines Eintrags: verknüpfte und dazugekommene mit kleiner Scheibe, Uhrzeit, Ergebnis und „Lösen“, eine
 * gelöschte als „Scheibe gelöscht“, darunter „Vom selben Abend“ mit „Dazunehmen“, wenn sie nicht von selbst dazukommen.
 */
export function EntryCards({
  entryId,
  cards,
  marks,
  executions,
  dayLabel,
  timeZone,
}: {
  entryId: string
  cards: EntryCardView
  marks: Record<string, CardMark[]>
  /** bewertete Serien je Scheibe, für die Rückfrage beim Lösen */
  executions: Record<string, number>
  dayLabel: string
  timeZone: string
}) {
  const router = useRouter()
  const [asking, setAsking] = useState<{ cardId: string; when: string } | null>(null)
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

  const release = (cardId: string, when: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => setAsking({ cardId, when })}
      className={`${PILL} text-foreground-2`}
    >
      Lösen
    </button>
  )
  const row = (card: ResultCard, extra?: string) => {
    const time = timeOf(card, timeZone)
    const shots = markShots(marks[card.id] ?? [])
    const facts = [card.result ? resultText(card.result) : "–", PROVENANCE[card.provenance]]
      .filter(Boolean)
      .join(" · ")
    return (
      <div key={card.id} data-entry-card={card.id} className="flex items-center gap-3 py-2">
        <Link
          href={`/cards/${encodeURIComponent(card.id)}`}
          aria-label={`Scheibe ${time} öffnen`}
          className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {card.targetId && (
            <MiniTarget
              target={TARGETS[card.targetId]}
              shots={shots}
              placeholder={shots.length === 0}
              className="size-10 shrink-0"
            />
          )}
          <span className="grid min-w-0 text-sm tabular-nums">
            <span>
              <span className="font-semibold text-primary">{time}</span>
              <span className="text-foreground-2">{` · ${facts}`}</span>
            </span>
            {extra && <span className="text-[12px] text-muted-foreground">{extra}</span>}
          </span>
        </Link>
        {release(card.id, `${dayLabel} · ${time}`)}
      </div>
    )
  }

  const own = cards.linked.length + cards.added.length
  return (
    <section
      data-entry-cards
      aria-label="Scheiben"
      className="rounded-2xl border border-border bg-card px-4 py-2"
    >
      <div className="grid divide-y divide-border">
        {cards.linked.map(({ id, card }) =>
          card ? (
            row(card)
          ) : (
            <div key={id} data-card-gone className="flex items-center gap-3 py-2">
              <span className="flex-1 text-sm text-muted-foreground">{ENTRY_TEXTS.cardGone}</span>
              {release(id, dayLabel)}
            </div>
          )
        )}
        {cards.added.map((card) => row(card, ENTRY_TEXTS.added))}
        {own === 0 && <p className="py-2 text-sm text-muted-foreground">{ENTRY_TEXTS.noCard}</p>}
      </div>
      {cards.offered.length > 0 && (
        <div data-offered className="my-2 grid gap-0.5 rounded-xl bg-surface-2 px-3 pt-2 pb-1">
          <p className="text-[13px] font-semibold text-foreground-2">{ENTRY_TEXTS.sameEvening}</p>
          {cards.offered.map((card) => (
            <div key={card.id} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 text-sm tabular-nums">
                <span className="font-semibold text-primary">{timeOf(card, timeZone)}</span>
                <span className="text-foreground-2">
                  {` · ${card.result ? resultText(card.result) : "–"}`}
                </span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => addEntryCard(entryId, card.id))}
                className={`${PILL} text-primary`}
              >
                {ENTRY_TEXTS.add}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={diaryCardRelease({
          when: asking?.when ?? dayLabel,
          executions: asking ? (executions[asking.cardId] ?? 0) : 0,
        })}
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        onConfirm={() => {
          const cardId = asking?.cardId
          setAsking(null)
          if (cardId) run(() => releaseEntryCard(entryId, cardId))
        }}
      />
    </section>
  )
}
