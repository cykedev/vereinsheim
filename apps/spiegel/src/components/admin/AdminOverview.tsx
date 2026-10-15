import Link from "next/link"

import { cn } from "@vereinsheim/lib/utils"

import type { AdminOverviewModel, StationTone } from "@/lib/admin/overview"

import { AdminHelp } from "./AdminHelp"

const TONE: Record<StationTone, string> = {
  ok: "bg-success-wash text-success",
  wait: "bg-warning-wash text-warning",
  neutral: "bg-surface-2 text-foreground-2",
}

/**
 * Übersicht des Admins: oben, was auf eine Entscheidung wartet, darunter der Weg einer Scheibe in vier
 * Stationen, je mit einem Satz, was sie tut, ihrem Stand und einem „?“.
 */
export function AdminOverview({ model }: { model: AdminOverviewModel }) {
  return (
    <div className="grid gap-4">
      <section
        data-admin-tasks
        aria-labelledby="tasks-title"
        className={cn(
          "grid gap-3 rounded-2xl p-4",
          model.tasks.length
            ? "border border-gold-line bg-gold-wash"
            : "border border-border bg-card"
        )}
      >
        <h2 id="tasks-title" className="text-[15px] font-semibold">
          Wartet auf dich ({model.tasks.length})
        </h2>
        {model.tasks.length ? (
          <ul className="grid gap-2">
            {model.tasks.map((task) => (
              <li
                key={task.id}
                data-admin-task={task.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="grid min-w-0">
                  <span className="text-[15px] font-semibold">{task.title}</span>
                  <span className="text-[13px] text-muted-foreground">{task.detail}</span>
                </span>
                <Link
                  href={task.href}
                  className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {task.action}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground-2">Nichts wartet auf dich.</p>
        )}
      </section>

      <section aria-labelledby="path-title" className="grid gap-2">
        <h2 id="path-title" className="text-[13px] text-muted-foreground">
          Der Weg einer Scheibe
        </h2>
        <ol className="grid gap-2">
          {model.stations.map((station, i) => (
            <li key={station.id} data-admin-station={station.id} className="grid gap-2">
              {i > 0 && (
                <span aria-hidden="true" className="justify-self-center text-quiet">
                  ↓
                </span>
              )}
              <div className="grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-2xl bg-card p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold">
                  {i + 1}
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <div className="flex items-center gap-1">
                    <h3 className="text-[15px] font-semibold">{station.title}</h3>
                    <AdminHelp id={station.help} />
                  </div>
                  <p className="text-sm text-foreground-2">{station.does}</p>
                  {station.facts.map((fact) => (
                    <p key={fact} className="text-[13px] text-muted-foreground">
                      {fact}
                    </p>
                  ))}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    TONE[station.tone]
                  )}
                >
                  {station.status}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
