import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { Route } from "../nav/routes"
import {
  CalendarBrowser,
  calendarWeeks,
  calendarWindow,
  CalendarChart,
  dayLevel,
  dayText,
  pageEarlier,
  pageLater,
  weeksThatFit,
} from "./CalendarChart"

const dayRoute = (day: string): Route => ({
  page: "cards",
  query: {
    family: "lg-freihand",
    kind: "all",
    flag: null,
    provenance: null,
    list: null,
    range: null,
  },
  evening: day,
})

describe("Kalender der Trainingstage (T7)", () => {
  it("Wochen ab dem Montag vor dem ersten Tag bis zum letzten, je sieben Tage", () => {
    // 2. Juli 2026 ist ein Donnerstag, 30. September ein Mittwoch
    const weeks = calendarWeeks("2026-07-02", "2026-09-30")
    expect(weeks[0]).toEqual({
      key: "2026-W27",
      days: [
        "2026-06-29",
        "2026-06-30",
        "2026-07-01",
        "2026-07-02",
        "2026-07-03",
        "2026-07-04",
        "2026-07-05",
      ],
    })
    expect(weeks.at(-1)?.days[0]).toBe("2026-09-28")
    expect(weeks).toHaveLength(14)
    // über den Jahreswechsel: ISO-Woche 53 von 2026 beginnt am 28. Dezember
    expect(calendarWeeks("2026-12-30", "2027-01-05").map((w) => w.key)).toEqual([
      "2026-W53",
      "2027-W01",
    ])
  })

  it("vier Stufen relativ zum stärksten Tag, jeder Trainingstag mindestens die erste", () => {
    expect(dayLevel(1, 100)).toBe(0)
    expect(dayLevel(25, 100)).toBe(0)
    expect(dayLevel(26, 100)).toBe(1)
    expect(dayLevel(75, 100)).toBe(2)
    expect(dayLevel(100, 100)).toBe(3)
  })

  it("jeder Trainingstag ein Link an den Abend in der Liste, mit Tag, Scheiben und Schüssen als Namen", () => {
    const days = [
      { key: "2026-09-27", shots: 40, cards: 1, competition: 0 },
      { key: "2026-09-29", shots: 80, cards: 2, competition: 1 },
    ]
    expect(dayText(days[1])).toBe("Di 29.09.2026: 2 Scheiben, 80 Schuss, davon 1 Wettkampf")
    const html = renderToStaticMarkup(
      createElement(CalendarChart, { from: "2026-09-20", to: "2026-09-30", days, dayRoute })
    )
    const links = [...html.matchAll(/<a [^>]*data-day="([\d-]+)"[^>]*>/g)]
    expect(links.map((m) => m[1])).toEqual(["2026-09-27", "2026-09-29"])
    expect(links[1][0]).toContain("#2026-09-29")
    expect(links[1][0]).toContain("ring-gold")
    expect(links[0][0]).not.toContain("ring-gold")
    // Tage ohne Training im Zeitraum sind Felder, Tage davor und danach leer
    expect([...html.matchAll(/bg-surface-2/g)].length).toBeGreaterThanOrEqual(9)
    expect(html).toContain("2 Trainingstage · 120 Schuss")
    expect(html).toContain("Wettkampf")
  })

  it("Monatsnamen: über jeder Woche, in der ein Monat beginnt; die erste nur, wenn danach keiner beginnt", () => {
    const months = (from: string, to: string) =>
      [
        ...renderToStaticMarkup(
          createElement(CalendarChart, { from, to, days: [], dayRoute })
        ).matchAll(/data-week="([\dW-]+)"[^>]*><span[^>]*>([^<]*)<\/span>/g),
      ]
        .filter((m) => m[2])
        .map((m) => `${m[1]}:${m[2]}`)
    // ab dem 25. September: Woche 39 trüge „Sep“ über „Okt“ der nächsten, also nur Oktober
    expect(months("2026-09-25", "2026-10-13")).toEqual(["2026-W40:Okt"])
    // ab dem 28. September: Woche 40 enthält den 1. Oktober und heißt Oktober
    expect(months("2026-09-28", "2026-10-13")).toEqual(["2026-W40:Okt"])
    expect(months("2026-09-07", "2026-10-13")).toEqual(["2026-W37:Sep", "2026-W40:Okt"])
  })
})

describe("Kalender blätterbar", () => {
  // Donnerstag, 15. Oktober 2026; seine Woche beginnt am Montag, dem 12.
  const TODAY = "2026-10-15"

  it("so viele Wochen, wie nebeneinander passen: 13 px je Woche und 3 px Abstand, mindestens vier", () => {
    expect(weeksThatFit(16 * 18 - 3)).toBe(18)
    expect(weeksThatFit(16 * 18 - 4)).toBe(17)
    expect(weeksThatFit(20)).toBe(4)
  })

  it("das Fenster endet mit der Woche des Endes, nie nach heute, und beginnt am Montag davor", () => {
    expect(calendarWindow({ end: TODAY, first: "2025-01-10", today: TODAY }, 13)).toEqual({
      from: "2026-07-20",
      to: TODAY,
      earlier: true,
      later: false,
    })
    // ein Zeitraum in der Vergangenheit, der an einem Dienstag endet: seine Woche ganz
    expect(calendarWindow({ end: "2026-06-30", first: "2025-01-10", today: TODAY }, 4)).toEqual({
      from: "2026-06-08",
      to: "2026-07-05",
      earlier: true,
      later: true,
    })
    // ein Ende nach heute zählt als heute
    expect(calendarWindow({ end: "2026-12-31", first: null, today: TODAY }, 13)).toEqual({
      from: "2026-07-20",
      to: TODAY,
      earlier: false,
      later: false,
    })
    // die erste Scheibe im Fenster: nichts davor
    expect(calendarWindow({ end: TODAY, first: "2026-07-20", today: TODAY }, 13).earlier).toBe(
      false
    )
    expect(calendarWindow({ end: TODAY, first: "2026-07-19", today: TODAY }, 13).earlier).toBe(true)
  })

  it("früher endet am Tag vor dem Fenster, später ein Fenster weiter, höchstens bis heute", () => {
    const now = { first: "2026-03-01", today: TODAY }
    const first = calendarWindow({ ...now, end: TODAY }, 13)
    const earlier = calendarWindow({ ...now, end: pageEarlier(first) }, 13)
    expect(earlier).toEqual({ from: "2026-04-20", to: "2026-07-19", earlier: true, later: true })
    expect(calendarWindow({ ...now, end: pageLater(earlier, 13) }, 13)).toEqual(first)
    // noch weiter zurück: das Fenster beginnt vor der ersten Scheibe
    expect(calendarWindow({ ...now, end: pageEarlier(earlier) }, 13).earlier).toBe(false)
  })

  it("Tage außerhalb des Zeitraums blass, die Zeile zählt nur den Zeitraum", () => {
    const days = [
      { key: "2026-08-02", shots: 30, cards: 1, competition: 0 },
      { key: "2026-10-01", shots: 60, cards: 1, competition: 1 },
    ]
    const html = renderToStaticMarkup(
      createElement(CalendarBrowser, {
        end: TODAY,
        period: { from: "2026-09-16", to: TODAY },
        today: TODAY,
        days,
        dayRoute,
      })
    )
    const link = (day: string) => html.match(new RegExp(`<a [^>]*data-day="${day}"[^>]*>`))![0]
    expect(link("2026-08-02")).toContain("data-outside")
    expect(link("2026-08-02")).toContain("opacity-35")
    expect(link("2026-10-01")).not.toContain("data-outside")
    // leere Tage vor dem Zeitraum ebenso blass
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*bg-surface-2[^"]*opacity-35/)
    expect(html).toContain("1 Trainingstag im Zeitraum · 60 Schuss")
    expect(html).toContain("außerhalb des Zeitraums")
    // „Alles“: kein Tag außerhalb, die Zeile ohne „im Zeitraum“, die Legende ohne „außerhalb“
    const all = renderToStaticMarkup(
      createElement(CalendarBrowser, {
        end: TODAY,
        period: { from: "2020-01-01", to: TODAY },
        today: TODAY,
        days,
        dayRoute,
      })
    )
    expect(all).toContain("2 Trainingstage · 90 Schuss")
    expect(all).not.toContain("außerhalb des Zeitraums")
    expect(all).not.toContain("data-outside")
  })

  it("zeigt anfangs die Wochen bis zum Ende des Zeitraums, „früher“ wählbar, „später“ nicht", () => {
    const days = [
      { key: "2026-03-14", shots: 40, cards: 1, competition: 0 },
      { key: "2026-08-02", shots: 30, cards: 1, competition: 0 },
      { key: "2026-10-01", shots: 60, cards: 1, competition: 1 },
    ]
    const html = renderToStaticMarkup(
      createElement(CalendarBrowser, {
        end: TODAY,
        period: { from: "2026-07-01", to: TODAY },
        today: TODAY,
        days,
        dayRoute,
      })
    )
    // vor dem Messen 13 Wochen: der 2. August steht da, der 14. März nicht
    expect([...html.matchAll(/data-day="([\d-]+)"/g)].map((m) => m[1])).toEqual([
      "2026-08-02",
      "2026-10-01",
    ])
    expect([...html.matchAll(/data-week="/g)]).toHaveLength(13)
    expect(html).toContain("2 Trainingstage · 90 Schuss")
    expect(html).toMatch(/<button type="button" data-calendar-earlier="true"[^>]*>/)
    expect(html).not.toMatch(/data-calendar-earlier="true"[^>]*disabled=""/)
    expect(html).toMatch(/data-calendar-later="true"[^>]*disabled=""/)
    expect(html).toContain("20.07.2026 – 15.10.2026")
  })
})
