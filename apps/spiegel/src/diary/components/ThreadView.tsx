import { ChevronRight, Plus } from "lucide-react"
import Link from "next/link"

import { NO_FAMILY } from "../paths"
import type { Family, ThreadItem } from "../queries"
import type { RoutineSummary } from "../routines/queries"
import { ROUTINE_TEXTS } from "../routines/texts"
import { dayLabel } from "../summaries"
import { LIST_TEXTS } from "../texts"

const CHIP =
  "inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:text-foreground"

/**
 * Der Faden: je Disziplin oben ihre Abläufe (der Stand, wie man schießt), darunter die Lernfragen mit dem, was gelernt
 * wurde (wie man dahin kam), neueste oben; jeder Punkt führt in seinen Eintrag. Mehrere Disziplinen wählt ein Chip
 * (`?family=`), Abläufe ohne Disziplin stehen unter „Ohne Disziplin“.
 */
export function ThreadView({
  families,
  family,
  withoutFamily,
  noFamily,
  items,
  routines,
  timeZone,
}: {
  families: Family[]
  family: Family | null
  withoutFamily: boolean
  noFamily: boolean
  items: ThreadItem[]
  routines: RoutineSummary[]
  timeZone: string
}) {
  const chips = families.length > 0 || withoutFamily
  return (
    <div data-thread className="grid gap-4">
      {chips && (
        <nav aria-label="Disziplin" className="flex flex-wrap gap-2">
          {families.map((f) => (
            <Link
              key={f.id}
              href={`/diary/thread?family=${encodeURIComponent(f.slug)}`}
              aria-current={f.id === family?.id ? "page" : undefined}
              className={CHIP}
            >
              {f.name}
            </Link>
          ))}
          {withoutFamily && (
            <Link
              href={`/diary/thread?family=${NO_FAMILY}`}
              aria-current={noFamily ? "page" : undefined}
              className={CHIP}
            >
              {ROUTINE_TEXTS.noFamily}
            </Link>
          )}
        </nav>
      )}
      {noFamily && <p className="text-sm text-foreground-2">{ROUTINE_TEXTS.noFamilyLead}</p>}
      <RoutineBox family={family} noFamily={noFamily} routines={routines} />
      {noFamily ? null : !family || items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{LIST_TEXTS.threadEmpty}</p>
      ) : (
        <>
          <p className="text-sm text-foreground-2">{LIST_TEXTS.threadLead}</p>
          <ol className="grid">
            {items.map((item, i) => (
              <li
                key={item.entryId}
                data-thread-item={item.entryId}
                className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3"
              >
                <span aria-hidden className="flex flex-col items-center">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
                  {i < items.length - 1 && <span className="w-px flex-1 bg-line-strong" />}
                </span>
                <span className="grid gap-1 pb-5">
                  <Link
                    href={`/diary/${item.entryId}`}
                    className="justify-self-start text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {`${dayLabel(item.day, timeZone)} · ${LIST_TEXTS.threadEntry}`}
                  </Link>
                  <span className="text-[15px] font-semibold">{`Wie schaffe ich es, ${item.question}`}</span>
                  {item.learned && (
                    <span className="text-sm text-foreground-2">{`Ich habe gelernt, dass ${item.learned}`}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

/** der Kasten „Abläufe“: je Ablauf eine Zeile, die ganz der Link ist; „+“ legt einen neuen an */
function RoutineBox({
  family,
  noFamily,
  routines,
}: {
  family: Family | null
  noFamily: boolean
  routines: RoutineSummary[]
}) {
  const newHref =
    family && !noFamily
      ? `/diary/routines/new?family=${encodeURIComponent(family.slug)}`
      : "/diary/routines/new"
  return (
    <section
      data-routine-box
      aria-labelledby="routine-box-title"
      className="grid gap-1 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid min-w-0">
          <h2 id="routine-box-title" className="text-[15px] font-semibold">
            {ROUTINE_TEXTS.box}
          </h2>
          {routines.length === 0 && (
            <span className="text-[13px] text-muted-foreground">
              {family && !noFamily ? ROUTINE_TEXTS.empty(family.name) : ROUTINE_TEXTS.emptyAny}
            </span>
          )}
        </span>
        <Link
          href={newHref}
          aria-label={ROUTINE_TEXTS.newRoutine}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Plus aria-hidden className="size-4" />
        </Link>
      </div>
      {routines.length > 0 && (
        <ul className="grid divide-y divide-border">
          {routines.map((routine) => (
            <li key={routine.id}>
              <Link
                href={`/diary/routines/${routine.id}`}
                data-routine={routine.id}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="grid min-w-0">
                  <span className="truncate text-sm font-semibold">{routine.name}</span>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {ROUTINE_TEXTS.steps(routine.steps)}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
