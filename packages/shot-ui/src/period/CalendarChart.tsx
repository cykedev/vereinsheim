"use client"

import { formatDateOnly, formatMonthShort, formatWeekdayDate } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"

import type { Route } from "../nav/routes"
import { RouteLink } from "../nav/RouteLink"
import { addDays, isoWeekKey, weeksBetween, weekStartIso } from "./calendar"
import { useElementWidth } from "../target/useAnimatedViewBox"
import type { CalendarDay } from "./model"

/**
 * Stufen der Tönung nach Schüssen, relativ zum stärksten Tag des Zeitraums; Klassen wörtlich (Tailwind). Die unterste
 * hebt sich deutlich von einem Tag ohne Training ab (bei /30 nur 1,5 : 1)
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

/** Breite einer Woche (13 px) und Abstand dazwischen (3 px), wie gezeichnet */
const WEEK_PX = 13
const GAP_PX = 3
/**
 * Platz für einen Monatsnamen über der letzten Woche: „Dez“ ist breiter als die Spalte und ragte sonst über den Rand,
 * der Kalender scrollte dann seitlich
 */
const LABEL_OVERHANG_PX = 8
/** vor dem Messen (Server, erstes Bild) und als Untergrenze */
const DEFAULT_WEEKS = 13
const MIN_WEEKS = 4

/** wie viele Wochen nebeneinander in `width` Pixel passen, mindestens vier */
export const weeksThatFit = (width: number) =>
  Math.max(MIN_WEEKS, Math.floor((width + GAP_PX) / (WEEK_PX + GAP_PX)))

const mondayOf = (iso: string) => weekStartIso(isoWeekKey(iso))

/**
 * Das Fenster des Kalenders: `weeks` ganze Wochen bis zur Woche von `end`, nie über heute hinaus. Früher geht,
 * solange vor dem Fenster eine Scheibe liegt (`first`), später, solange es vor der Woche von heute endet.
 */
export function calendarWindow(
  { end, first, today }: { end: string; first: string | null; today: string },
  weeks: number
): { from: string; to: string; earlier: boolean; later: boolean } {
  const lastMonday = mondayOf(end > today ? today : end)
  const from = addDays(lastMonday, -7 * (weeks - 1))
  const sunday = addDays(lastMonday, 6)
  return {
    from,
    to: sunday > today ? today : sunday,
    earlier: first !== null && first < from,
    later: lastMonday < mondayOf(today),
  }
}

/** das Ende des Fensters davor: der Tag vor seinem Anfang */
export const pageEarlier = (shown: { from: string }) => addDays(shown.from, -1)

/** das Ende des Fensters danach (`calendarWindow` begrenzt es auf heute) */
export const pageLater = (shown: { to: string }, weeks: number) => addDays(shown.to, 7 * weeks)

/** Knopf zum Blättern: leise umrandet, gesperrt sichtbar zurückgenommen */
const PAGE_BUTTON =
  "inline-flex cursor-pointer items-center gap-1 rounded-full border border-line-strong px-3 py-1.5 text-[13px] leading-none font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"

/**
 * Der Kalender zum Blättern: alle Trainingstage der Familie (`days`), gezeigt in so vielen Wochen, wie nebeneinander
 * passen (`calendarWindow`), darüber „‹ früher“ und „später ›“. Am Anfang endet das Fenster mit dem Zeitraum (`end`);
 * ein neuer Zeitraum hängt ihn neu ein (`key`).
 */
export function CalendarBrowser({
  end,
  period,
  today,
  days,
  dayRoute,
}: {
  end: string
  /** der gewählte Zeitraum: Tage davor und danach stehen blass da */
  period: { from: string; to: string }
  today: string
  days: readonly CalendarDay[]
  dayRoute: (day: string) => Route
}) {
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS)
  const [last, setLast] = useState(end)
  const shown = calendarWindow({ end: last, first: days[0]?.key ?? null, today }, weeks)
  return (
    <CalendarChart
      from={shown.from}
      to={shown.to}
      days={days.filter((day) => day.key >= shown.from && day.key <= shown.to)}
      dayRoute={dayRoute}
      period={period}
      onFit={setWeeks}
      paging={{
        earlier: shown.earlier ? () => setLast(pageEarlier(shown)) : null,
        later: shown.later ? () => setLast(pageLater(shown, weeks)) : null,
      }}
    />
  )
}

/**
 * Kalender der Trainingstage (T7): je Woche eine Spalte, Montag bis Sonntag, getönt nach den Schüssen des Abends; ein
 * Abend mit Wettkampf trägt einen goldenen Rand. Jeder Trainingstag ist ein Link in die Liste an diesem Abend
 * (`dayRoute`), sein Name nennt Tag, Scheiben und Schüsse; Tage außerhalb von `from` bis `to` bleiben leer. Zu breit
 * scrollt er in sich und zeigt anfangs die jüngsten Wochen. Mit `paging` darüber die Knöpfe zum Blättern und die Tage
 * des Fensters; `onFit` meldet, wie viele Wochen in den Platz passen (`CalendarBrowser`).
 */
export function CalendarChart({
  from,
  to,
  days,
  dayRoute,
  paging,
  onFit,
  period,
}: {
  from: string
  to: string
  days: readonly CalendarDay[]
  dayRoute: (day: string) => Route
  /** Blättern (`CalendarBrowser`): je Richtung der Schritt, null gesperrt; ohne gibt es keine Knöpfe */
  paging?: { earlier: (() => void) | null; later: (() => void) | null }
  /** meldet die Zahl der Wochen, die in den Platz passen (gemessen ohne Rand) */
  onFit?: (weeks: number) => void
  /**
   * der gewählte Zeitraum, wenn das Fenster über ihn hinausgeht: Tage außerhalb blass, die Zeile darunter zählt nur
   * ihn
   */
  period?: { from: string; to: string }
}) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const [width, measure] = useElementWidth()
  const setScroller = useCallback(
    (node: HTMLDivElement | null) => {
      scroller.current = node
      measure(node)
    },
    [measure]
  )
  useEffect(() => {
    if (width > 0 && onFit) onFit(weeksThatFit(width - LABEL_OVERHANG_PX))
  }, [width, onFit])
  // ohne Blättern scrollt ein zu breiter Kalender in sich und zeigt anfangs die jüngsten Wochen; mit Blättern passt er
  const paged = paging !== undefined
  useEffect(() => {
    const node = scroller.current
    if (node && !paged) node.scrollLeft = node.scrollWidth
  }, [from, to, paged])
  const weeks = calendarWeeks(from, to)
  const byKey = new Map(days.map((day) => [day.key, day]))
  const max = Math.max(0, ...days.map((day) => day.shots))
  const competition = days.some((day) => day.competition > 0)
  const outside = (key: string) => !!period && (key < period.from || key > period.to)
  // geht das Fenster über den Zeitraum hinaus, zählt die Zeile nur die Tage in ihm
  const beyond = !!period && (from < period.from || to > period.to)
  const counted = days.filter((day) => !outside(day.key))

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
          ref={setScroller}
          className="min-w-0 flex-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                          className={cn(
                            "size-[13px] rounded-[3px] bg-surface-2",
                            outside(key) && "opacity-35"
                          )}
                        />
                      )
                    return (
                      <RouteLink
                        key={key}
                        route={dayRoute(key)}
                        data-day={key}
                        data-outside={outside(key) || undefined}
                        aria-label={`${dayText(day)}${outside(key) ? ", außerhalb des Zeitraums" : ""}`}
                        title={`${dayText(day)}${outside(key) ? ", außerhalb des Zeitraums" : ""}`}
                        className={cn(
                          "size-[13px] rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                          LEVELS[dayLevel(day.shots, max)],
                          day.competition > 0 && "ring-[1.5px] ring-gold",
                          outside(key) && "opacity-35"
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
          {plural(counted.length, "Trainingstag", "Trainingstage")}
          {beyond ? " im Zeitraum" : ""}
          {counted.length ? ` · ${counted.reduce((sum, d) => sum + d.shots, 0)} Schuss` : ""}
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
        {beyond && (
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className={cn("size-[13px] rounded-[3px] opacity-35", LEVELS[2])} />
            außerhalb des Zeitraums
          </span>
        )}
      </div>
    </div>
  )
}
