"use client"

import { formatMonthShort, formatWeekdayDate } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { useEffect, useRef } from "react"

import type { Route } from "../nav/routes"
import { RouteLink } from "../nav/RouteLink"
import { DAY_MS, isoWeekKey, weekStartIso } from "./calendar"
import type { CalendarDay } from "./model"

/** Stufen der Tönung nach Schüssen, relativ zum stärksten Tag des Zeitraums; Klassen wörtlich (Tailwind) */
const LEVELS = ["bg-primary/30", "bg-primary/50", "bg-primary/75", "bg-primary"] as const

/** Zeilen Montag bis Sonntag; beschriftet nur Mo, Mi, Fr (wie üblich, sonst zu eng) */
const WEEKDAYS = ["Mo", "", "Mi", "", "Fr", "", ""] as const

const noon = (iso: string) => new Date(`${iso}T12:00:00Z`)
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** „Di 07.10.2026: 2 Scheiben, 80 Schuss, davon 1 Wettkampf“ */
export function dayText(day: CalendarDay): string {
  const competition = day.competition ? `, davon ${day.competition} Wettkampf` : ""
  return `${formatWeekdayDate(noon(day.key), "UTC")}: ${plural(day.cards, "Scheibe", "Scheiben")}, ${day.shots} Schuss${competition}`
}

/** die Stufe eines Tages: ein Viertel des stärksten Tages je Stufe, jeder Trainingstag mindestens die erste */
export function dayLevel(shots: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(LEVELS.length - 1, Math.max(0, Math.ceil((shots / max) * LEVELS.length) - 1))
}

/** die Wochen (ISO, Montag) vom ersten bis zum letzten Tag, je mit ihren sieben Tagen */
export function calendarWeeks(from: string, to: string): { key: string; days: string[] }[] {
  const weeks: { key: string; days: string[] }[] = []
  for (let monday = weekStartIso(isoWeekKey(from)); monday <= to; monday = addDays(monday, 7)) {
    weeks.push({
      key: isoWeekKey(monday),
      days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    })
  }
  return weeks
}

/**
 * Kalender der Trainingstage (T7): je Woche eine Spalte, Montag bis Sonntag, getönt nach den Schüssen des Abends; ein
 * Abend mit Wettkampf trägt einen goldenen Rand. Jeder Trainingstag ist ein Link in die Liste an diesem Abend
 * (`dayRoute`), sein Name nennt Tag, Scheiben und Schüsse; Tage außerhalb des Zeitraums bleiben leer. Zu breit scrollt
 * er in sich und zeigt anfangs die jüngsten Wochen.
 */
export function CalendarChart({
  from,
  to,
  days,
  dayRoute,
}: {
  from: string
  to: string
  days: readonly CalendarDay[]
  dayRoute: (day: string) => Route
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [from, to])
  const weeks = calendarWeeks(from, to)
  const byKey = new Map(days.map((day) => [day.key, day]))
  const max = Math.max(0, ...days.map((day) => day.shots))
  const competition = days.some((day) => day.competition > 0)

  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 gap-1.5">
        <div className="grid shrink-0 grid-rows-[16px_repeat(7,13px)] gap-[3px] text-xs leading-[13px] text-muted-foreground">
          <span aria-hidden />
          {WEEKDAYS.map((label, i) => (
            <span key={i} aria-hidden>
              {label}
            </span>
          ))}
        </div>
        <div
          ref={scroller}
          className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div role="group" aria-label="Trainingstage" className="flex gap-[3px]">
            {weeks.map((week, i) => {
              // der Monat über der ersten Woche und über jeder, in der ein Monat beginnt
              const first = week.days.find((d) => d.endsWith("-01") && d >= from && d <= to)
              const label = i === 0 ? week.days.find((d) => d >= from) : first
              return (
                <div
                  key={week.key}
                  data-week={week.key}
                  className="grid shrink-0 grid-rows-[16px_repeat(7,13px)] gap-[3px]"
                >
                  <span className="w-[13px] overflow-visible text-xs leading-[13px] whitespace-nowrap text-muted-foreground">
                    {label ? formatMonthShort(noon(label), "UTC") : ""}
                  </span>
                  {week.days.map((key) => {
                    if (key < from || key > to) return <span key={key} aria-hidden />
                    const day = byKey.get(key)
                    if (!day)
                      return (
                        <span
                          key={key}
                          aria-hidden
                          className="size-[13px] rounded-[3px] bg-surface-2"
                        />
                      )
                    return (
                      <RouteLink
                        key={key}
                        route={dayRoute(key)}
                        data-day={key}
                        aria-label={dayText(day)}
                        title={dayText(day)}
                        className={cn(
                          "size-[13px] rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                          LEVELS[dayLevel(day.shots, max)],
                          day.competition > 0 && "ring-[1.5px] ring-gold"
                        )}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {plural(days.length, "Trainingstag", "Trainingstage")}
          {days.length ? ` · ${days.reduce((sum, d) => sum + d.shots, 0)} Schuss` : ""}
        </span>
        <span className="flex items-center gap-1.5" aria-hidden>
          weniger
          {LEVELS.map((level) => (
            <span key={level} className={cn("size-[13px] rounded-[3px]", level)} />
          ))}
          mehr
          {competition && (
            <>
              <span className="ml-2 size-[13px] rounded-[3px] bg-surface-2 ring-[1.5px] ring-gold" />
              Wettkampf
            </>
          )}
        </span>
      </div>
    </div>
  )
}
