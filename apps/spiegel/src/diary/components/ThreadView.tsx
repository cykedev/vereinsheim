import Link from "next/link"

import type { Family, ThreadItem } from "../queries"
import { dayLabel } from "../summaries"
import { LIST_TEXTS } from "../texts"

const CHIP =
  "inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:text-foreground"

/**
 * Der Faden: je Disziplin die Lernfragen mit dem, was gelernt wurde, neueste oben; jeder Punkt führt in seinen Eintrag.
 * Mehrere Disziplinen wählt ein Chip (`?family=`).
 */
export function ThreadView({
  families,
  family,
  items,
  timeZone,
}: {
  families: Family[]
  family: Family | null
  items: ThreadItem[]
  timeZone: string
}) {
  return (
    <div data-thread className="grid gap-4">
      {families.length > 0 && (
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
        </nav>
      )}
      {!family || items.length === 0 ? (
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
