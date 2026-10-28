import { ListOrdered } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@vereinsheim/ui/empty-state"

import type { RoutineGroup } from "../routines/queries"
import { ROUTINE_TEXTS } from "../routines/texts"

/**
 * Die Abläufe je Disziplin, „Ohne Disziplin“ zuletzt; eine Disziplin ohne Ablauf fehlt. Die ganze Karte ist der Link
 * (conventions §7): der Name, darunter die Zahl der Schritte.
 */
export function RoutineList({ groups }: { groups: readonly RoutineGroup[] }) {
  if (!groups.length)
    return (
      <EmptyState
        title={ROUTINE_TEXTS.emptyTitle}
        description={ROUTINE_TEXTS.emptyText}
        icon={ListOrdered}
        actionLabel={ROUTINE_TEXTS.newRoutine}
        actionHref="/diary/routines/new"
      />
    )
  return (
    <div data-routine-list className="grid gap-6">
      {groups.map(({ family, routines }) => {
        const title = family?.name ?? ROUTINE_TEXTS.noFamily
        return (
          <section
            key={family?.id ?? "none"}
            data-routine-group={family?.slug ?? "none"}
            className="grid gap-3"
            aria-label={title}
          >
            <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
            <ul className="grid gap-3">
              {routines.map((routine) => (
                <li key={routine.id}>
                  <Link
                    href={`/diary/routines/${routine.id}`}
                    data-routine={routine.id}
                    className="grid gap-1 rounded-2xl border border-border bg-card p-4 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="text-[15px] font-semibold">{routine.name}</span>
                    <span className="text-[13px] text-foreground-2 tabular-nums">
                      {ROUTINE_TEXTS.steps(routine.steps)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
