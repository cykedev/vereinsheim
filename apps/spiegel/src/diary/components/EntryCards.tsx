"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import type { CardMark } from "@vereinsheim/shot-core/projection"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Sheet } from "@vereinsheim/ui/design2/sheet"

import type { ResultCard } from "@/lib/results-read"
import type { ActionResult } from "@/lib/types"

import { addEntryCard, releaseEntryCard } from "../actions"
import { diaryCardRelease } from "../consequences"
import type { EntryCardView } from "../queries"
import { ENTRY_TEXTS, ERRORS } from "../texts"

import { CardHead, timeOf } from "./CardHead"

/** eine Zeile im Blatt: die Scheibe, ob sie in diesem Eintrag ist, und wo sonst */
interface SheetRow {
  id: string
  card: ResultCard | null
  here: boolean
  elsewhere: string | null
  startedAtMs: number
}

/**
 * Die Scheiben eines Eintrags wie in der Scheibenliste: kleine Scheibe, Uhrzeit, Ringe; die ganze Zeile führt zur
 * Scheibe, eine gelöschte steht als „Scheibe gelöscht“. Darunter leise „Scheiben ändern“: ein Blatt mit allen Scheiben
 * dieses Tages und dieser Disziplin zum An- und Abhaken (anhaken verknüpft, abhaken löst). Wer bewertete Serien abhakt,
 * wird erst gefragt.
 */
export function EntryCards({
  entryId,
  cards,
  marks,
  executions,
  dayLabel,
  familyName,
  timeZone,
}: {
  entryId: string
  cards: EntryCardView
  marks: Record<string, CardMark[]>
  /** bewertete Serien je Scheibe, für die Rückfrage beim Abhaken */
  executions: Record<string, number>
  dayLabel: string
  familyName: string
  timeZone: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

  const own = [
    ...cards.linked.map(({ id, card }) => ({ id, card })),
    ...cards.added.map((card) => ({ id: card.id, card })),
  ].sort((a, b) => (a.card?.startedAtMs ?? Infinity) - (b.card?.startedAtMs ?? Infinity))
  const rows: SheetRow[] = [
    ...own.map(({ id, card }) => ({
      id,
      card,
      here: true,
      elsewhere: null,
      startedAtMs: card?.startedAtMs ?? Infinity,
    })),
    ...cards.offered.map((card) => ({
      id: card.id,
      card,
      here: false,
      elsewhere: null,
      startedAtMs: card.startedAtMs,
    })),
    ...cards.elsewhere.map(({ card, title }) => ({
      id: card.id,
      card,
      here: false,
      elsewhere: title,
      startedAtMs: card.startedAtMs,
    })),
  ].sort((a, b) => a.startedAtMs - b.startedAtMs)

  const toggle = (row: SheetRow) => {
    if (!row.here) return run(() => addEntryCard(entryId, row.id))
    if (executions[row.id]) {
      // die Rückfrage kann nicht über dem Blatt stehen: erst das Blatt schließen
      setOpen(false)
      setAsking({
        cardId: row.id,
        when: row.card ? `${dayLabel} · ${timeOf(row.card, timeZone)}` : dayLabel,
      })
      return
    }
    run(() => releaseEntryCard(entryId, row.id))
  }

  return (
    <section
      data-entry-cards
      aria-label="Scheiben"
      className="rounded-2xl border border-border bg-card px-4 py-2"
    >
      <div className="grid divide-y divide-border">
        {own.map(({ id, card }) =>
          card ? (
            <Link
              key={id}
              href={`/cards/${encodeURIComponent(id)}`}
              data-entry-card={id}
              className="flex items-center py-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <CardHead card={card} marks={marks} timeZone={timeZone} />
            </Link>
          ) : (
            <p key={id} data-card-gone className="py-2 text-sm text-muted-foreground">
              {ENTRY_TEXTS.cardGone}
            </p>
          )
        )}
        {own.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">{ENTRY_TEXTS.noCard}</p>
        )}
      </div>
      {rows.length > 0 && (
        <button
          type="button"
          data-change-cards
          onClick={() => setOpen(true)}
          className="-mx-1 my-1 inline-flex h-9 cursor-pointer items-center rounded-full px-1 text-[13px] font-semibold text-foreground-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
        >
          {ENTRY_TEXTS.changeCards}
        </button>
      )}
      {error && (
        <p role="alert" className="pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={ENTRY_TEXTS.changeCards}>
        <div data-cards-sheet className="grid gap-3">
          <p className="text-sm text-foreground-2">
            {ENTRY_TEXTS.changeCardsLead(dayLabel, familyName)}
          </p>
          <ul className="grid divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id}>
                <label
                  data-sheet-card={row.id}
                  className="flex cursor-pointer items-center gap-3 py-2 has-disabled:cursor-default"
                >
                  <input
                    type="checkbox"
                    checked={row.here}
                    disabled={pending || row.elsewhere !== null}
                    onChange={() => toggle(row)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="grid min-w-0">
                    {row.card ? (
                      <CardHead card={row.card} marks={marks} timeZone={timeZone} />
                    ) : (
                      <span className="text-sm text-muted-foreground">{ENTRY_TEXTS.cardGone}</span>
                    )}
                    {row.elsewhere !== null && (
                      <span className="text-[13px] text-muted-foreground">
                        {ENTRY_TEXTS.inOtherEntry(row.elsewhere)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-10 cursor-pointer items-center justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {ENTRY_TEXTS.done}
          </button>
        </div>
      </Sheet>
      <DecisionDialog
        decision={diaryCardRelease({
          when: asking?.when ?? dayLabel,
          executions: asking ? (executions[asking.cardId] ?? 0) : 0,
        })}
        open={asking !== null}
        onOpenChange={(next) => !next && setAsking(null)}
        onConfirm={() => {
          const cardId = asking?.cardId
          setAsking(null)
          if (cardId) run(() => releaseEntryCard(entryId, cardId))
        }}
      />
    </section>
  )
}
