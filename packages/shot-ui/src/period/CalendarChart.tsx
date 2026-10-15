"use client"

import { formatDateOnly, formatMonthShort, formatWeekdayDate } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { useEffect, useRef, useState } from "react"

import type { Route } from "../nav/routes"
import { RouteLink } from "../nav/RouteLink"
import { addDays, DAY_MS, weeksBetween } from "./calendar"
import type { CalendarDay } from "./model"

/**
 * Stufen der Tönung nach Schüssen, relativ zum stärksten Tag des Zeitraums; Klassen wörtlich (Tailwind). Die unterste
 * hebt sich deutlich von einem Tag ohne Training ab (Review: bei /30 nur 1,5 : 1)
 */
const LEVELS = ["bg-primary/45", "bg-primary/65", "bg-primary/85", "bg-primary"] as const

/** Zeilen Montag bis Sonntag; beschriftet nur Mo, Mi, Fr (wie üblich, sonst zu eng) */
const WEEKDAYS = ["Mo", "", "Mi", "", "Fr", "", ""] as const

const noon = (iso: string) => new Date(`${iso}T12:00:00Z`)

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

/** die Wochen des Kalenders (aus `period/calendar`, dieselben wie im Umfang je Woche) */
export const calendarWeeks = weeksBetween

/** das Fenster des Kalenders ist mindestens 13 Wochen lang */
export const MIN_CALENDAR_DAYS = 91

const daysFromTo = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1

/**
 * Das Fenster des Kalenders (User, 15. Oktober 2026: „Kalender ‚blätterbar‘ für ältere einträge“): so lang wie der
 * Zeitraum, mindestens 13 Wochen, am Anfang mit dem Ende des Zeitraums als Ende. `offset` verschiebt um ganze Fenster,
 * positiv nach früher, negativ nach später, nie über heute hinaus. Früher geht, solange vor dem Fenster eine Scheibe
 * liegt (`first`), später, solange es vor heute endet.
 */
export function calendarWindow(
  { from, to, first, today }: { from: string; to: string; first: string | null; today: string },
  offset: number
): { from: string; to: string; earlier: boolean; later: boolean } {
  const length = Math.max(MIN_CALENDAR_DAYS, daysFromTo(from, to))
  const shifted = addDays(to, -offset * length)
  const end = shifted > today ? today : shifted
  const start = addDays(end, -(length - 1))
  return { from: start, to: end, earlier: first !== null && first < start, later: end < today }
}

/** Knopf zum Blättern: leise umrandet, gesperrt sichtbar zurückgenommen */
const PAGE_BUTTON =
  "inline-flex cursor-pointer items-center gap-1 rounded-full border border-line-strong px-3 py-1.5 text-[13px] leading-none font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"

/**
 * Der Kalender zum Blättern: alle Trainingstage der Familie (`days`), gezeigt im Fenster aus `calendarWindow`, darüber
 * „‹ früher“ und „später ›“. Das Fenster beginnt am Zeitraum (`period`); ein neuer Zeitraum hängt ihn neu ein (`key`).
 */
export function CalendarBrowser({
  period,
  today,
  days,
  dayRoute,
}: {
  period: { from: string; to: string }
  today: string
  days: readonly CalendarDay[]
  dayRoute: (day: string) => Route
}) {
  const [offset, setOffset] = useState(0)
  const shown = calendarWindow({ ...period, first: days[0]?.key ?? null, today }, offset)
  return (
    <CalendarChart
      from={shown.from}
      to={shown.to}
      days={days.filter((day) => day.key >= shown.from && day.key <= shown.to)}
      dayRoute={dayRoute}
      paging={{
        earlier: shown.earlier ? () => setOffset(offset + 1) : null,
        later: shown.later ? () => setOffset(offset - 1) : null,
      }}
    />
  )
}

/**
 * Kalender der Trainingstage (T7): je Woche eine Spalte, Montag bis Sonntag, getönt nach den Schüssen des Abends; ein
 * Abend mit Wettkampf trägt einen goldenen Rand. Jeder Trainingstag ist ein Link in die Liste an diesem Abend
 * (`dayRoute`), sein Name nennt Tag, Scheiben und Schüsse; Tage außerhalb von `from` bis `to` bleiben leer. Zu breit
 * scrollt er in sich und zeigt anfangs die jüngsten Wochen. Mit `paging` darüber die Knöpfe zum Blättern und die Tage
 * des Fensters.
 */
export function CalendarChart({
  from,
  to,
  days,
  dayRoute,
  paging,
}: {
  from: string
  to: string
  days: readonly CalendarDay[]
  dayRoute: (day: string) => Route
  /** Blättern (`CalendarBrowser`): je Richtung der Schritt, null gesperrt; ohne gibt es keine Knöpfe */
  paging?: { earlier: (() => void) | null; later: (() => void) | null }
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
      {paging && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-calendar-earlier
            disabled={!paging.earlier}
            onClick={paging.earlier ?? undefined}
            className={PAGE_BUTTON}
          >
            <span aria-hidden>‹</span> früher
          </button>
          <span
            aria-live="polite"
            data-calendar-window={`${from}..${to}`}
            className="text-xs text-muted-foreground tabular-nums"
          >
            {`${formatDateOnly(noon(from), "UTC")} – ${formatDateOnly(noon(to), "UTC")}`}
          </span>
          <button
            type="button"
            data-calendar-later
            disabled={!paging.later}
            onClick={paging.later ?? undefined}
            className={PAGE_BUTTON}
          >
            später <span aria-hidden>›</span>
          </button>
        </div>
      )}
      <div className="flex min-w-0 gap-1.5">
        <div className="grid shrink-0 grid-rows-[16px_repeat(7,13px)] gap-[3px] py-1 text-xs leading-[13px] text-muted-foreground">
          <span aria-hidden />
          {WEEKDAYS.map((label, i) => (
            <span key={i} aria-hidden>
              {label}
            </span>
          ))}
        </div>
        <div
          ref={scroller}
          className="min-w-0 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div role="group" aria-label="Trainingstage" className="flex gap-[3px]">
            {weeks.map((week, i) => {
              // der Monat über jeder Woche, in der einer beginnt; über der ersten sonst ihr Monat, außer gleich danach beginnt
              // einer (die Namen lägen übereinander)
              const starts = (w: { days: string[] }) =>
                w.days.find((d) => d.endsWith("-01") && d >= from && d <= to)
              const first = starts(week)
              const label =
                first ??
                (i === 0 && !(weeks[1] && starts(weeks[1]))
                  ? week.days.find((d) => d >= from)
                  : undefined)
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
