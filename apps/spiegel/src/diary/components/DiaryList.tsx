import { BookOpen, Plus } from "lucide-react"
import Link from "next/link"

import { formatMonthYear, zonedDayStartMs } from "@vereinsheim/lib/format"
import { markShots, type CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { MiniTarget } from "@vereinsheim/shot-ui/target/MiniTarget"
import { EmptyState } from "@vereinsheim/ui/empty-state"

import type { EntrySummary } from "../queries"
import { entryLine, entryTitle } from "../summaries"
import { GOAL_TEXTS } from "../goals/texts"
import { LIST_TEXTS } from "../texts"

const PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"

/** so viele kleine Scheiben je Eintrag in der Liste, darüber „+N“ */
export const LIST_IMAGES = 5

/**
 * Kopf des Tagebuchs: Titel und der Knopf des Reiters („Neuer Eintrag“, bei Ziele „Neues Ziel“), darunter „Einträge ·
 * Faden · Ziele“
 */
export function DiaryHeader({ current }: { current: "entries" | "thread" | "goals" }) {
  const [href, label] =
    current === "goals"
      ? ["/diary/goals/new", GOAL_TEXTS.newGoal]
      : ["/diary/new", LIST_TEXTS.newEntry]
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          {LIST_TEXTS.title}
        </h1>
        <Link href={href} className={PRIMARY}>
          <Plus aria-hidden className="size-4" />
          {label}
        </Link>
      </div>
      <nav
        aria-label={LIST_TEXTS.title}
        data-diary-switch
        className="flex gap-1 justify-self-start rounded-full bg-surface-2 p-1 text-[13px] font-semibold"
      >
        {(
          [
            ["entries", "/diary", LIST_TEXTS.entries],
            ["thread", "/diary/thread", LIST_TEXTS.thread],
            ["goals", "/diary/goals", GOAL_TEXTS.tab],
          ] as const
        ).map(([key, href, label]) => (
          <Link
            key={key}
            href={href}
            aria-current={current === key ? "page" : undefined}
            className="rounded-full px-3.5 py-1.5 text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  )
}

/**
 * Die Einträge nach Monat, neueste oben. Die ganze Karte ist der Link (conventions §7): Titel ist das Vorhaben, sonst
 * die Disziplin; darunter Tag und Scheiben, dann der Anfang der Notiz; rechts bis zu fünf kleine Scheiben, darüber
 * hinaus „+N“.
 */
export function DiaryList({
  entries,
  marks,
  timeZone,
}: {
  entries: readonly EntrySummary[]
  marks: Record<string, CardMark[]>
  timeZone: string
}) {
  if (!entries.length)
    return (
      <EmptyState
        title={LIST_TEXTS.emptyTitle}
        description={LIST_TEXTS.emptyText}
        icon={BookOpen}
        actionLabel={LIST_TEXTS.newEntry}
        actionHref="/diary/new"
      />
    )
  const months = new Map<string, EntrySummary[]>()
  for (const entry of entries) {
    const month = formatMonthYear(
      new Date(zonedDayStartMs(entry.day, timeZone) + 12 * 3_600_000),
      timeZone
    )
    months.set(month, [...(months.get(month) ?? []), entry])
  }
  return (
    <div data-diary-list className="grid gap-6">
      {[...months].map(([month, list]) => (
        <section key={month} className="grid gap-3" aria-label={month}>
          <h2 className="text-[13px] font-semibold text-muted-foreground">{month}</h2>
          <ul className="grid gap-3">
            {list.map((entry) => {
              const family = entry.family?.name ?? null
              return (
                <li key={entry.id}>
                  <Link
                    href={`/diary/${entry.id}`}
                    data-diary-entry={entry.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="grid min-w-0 gap-1">
                      <span className="text-[15px] font-semibold">
                        {entryTitle({ intention: entry.intention, family, kind: entry.kind })}
                      </span>
                      <span className="text-[13px] text-foreground-2 tabular-nums">
                        {entryLine({ ...entry, family }, timeZone)}
                      </span>
                      {entry.note && (
                        <span className="line-clamp-2 text-sm whitespace-pre-line text-foreground-2">
                          {entry.note}
                        </span>
                      )}
                    </span>
                    <span className="flex max-w-[8.75rem] flex-wrap justify-end gap-1">
                      {entry.cards.slice(0, LIST_IMAGES).map((card) => {
                        const shots = markShots(marks[card.id] ?? [])
                        return card.targetId ? (
                          <MiniTarget
                            key={card.id}
                            target={TARGETS[card.targetId]}
                            shots={shots}
                            placeholder={shots.length === 0}
                            className="size-11"
                          />
                        ) : null
                      })}
                      {entry.cards.length > LIST_IMAGES && (
                        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-foreground-2 tabular-nums">
                          {`+${entry.cards.length - LIST_IMAGES}`}
                        </span>
                      )}
                      {entry.kind !== "shooting" && (
                        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                          <BookOpen aria-hidden className="size-5" />
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
