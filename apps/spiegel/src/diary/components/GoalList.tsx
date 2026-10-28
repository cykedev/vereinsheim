import { Flag } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@vereinsheim/ui/empty-state"

import { goalListMeta, goalListStand, goalListState } from "../goals/labels"
import type { GoalSummary } from "../goals/queries"
import { GOAL_TEXTS } from "../goals/texts"

/**
 * Die Ziele in drei Gruppen: laufend, kommend, vorbei; eine leere Gruppe fehlt. Die ganze Karte ist der Link
 * (conventions §7): der Satz, darunter Disziplin und Ende, dann der Stand in einer Zeile und rechts der Zustand.
 */
export function GoalList({
  groups,
  timeZone,
}: {
  groups: { running: GoalSummary[]; upcoming: GoalSummary[]; past: GoalSummary[] }
  timeZone: string
}) {
  const sections = [
    ["running", GOAL_TEXTS.running, groups.running],
    ["upcoming", GOAL_TEXTS.upcoming, groups.upcoming],
    ["past", GOAL_TEXTS.past, groups.past],
  ] as const
  if (sections.every(([, , goals]) => goals.length === 0))
    return (
      <EmptyState
        title={GOAL_TEXTS.emptyTitle}
        description={GOAL_TEXTS.emptyText}
        icon={Flag}
        actionLabel={GOAL_TEXTS.newGoal}
        actionHref="/diary/goals/new"
      />
    )
  return (
    <div data-goal-list className="grid gap-6">
      {sections.map(([key, title, goals]) =>
        goals.length ? (
          <section key={key} data-goal-group={key} className="grid gap-3" aria-label={title}>
            <h2 className="text-[13px] font-semibold text-muted-foreground">{title}</h2>
            <ul className="grid gap-3">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <Link
                    href={`/diary/goals/${goal.id}`}
                    data-goal={goal.id}
                    className="grid gap-1 rounded-2xl border border-border bg-card p-4 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="text-[15px] font-semibold">{goal.title}</span>
                    <span className="text-[13px] text-foreground-2 tabular-nums">
                      {goalListMeta(goal, timeZone)}
                    </span>
                    <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm tabular-nums">{goalListStand(goal)}</span>
                      <GoalState
                        text={goalListState(goal, timeZone)}
                        running={goal.phase.phase === "running" && !goal.outcome}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null
      )}
    </div>
  )
}

/** der Zustand mit einem weichen Punkt davor: blau, solange das Ziel läuft und unbeantwortet ist */
export function GoalState({ text, running }: { text: string; running: boolean }) {
  return (
    <span
      data-goal-state
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground"
    >
      <span aria-hidden className={`size-2 rounded-full ${running ? "bg-primary" : "bg-quiet"}`} />
      {text}
    </span>
  )
}
