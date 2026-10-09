import { describe, expect, it } from "vitest"

import { DEFAULT_CHOICE, type PeriodChoice } from "../period/calendar"
import {
  decodeChoice,
  decodeCompare,
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  encodeChoice,
  encodeCompare,
  listQueryFromParams,
  listQueryToParams,
  progressQueryFromParams,
  progressQueryToParams,
  type ProgressQuery,
} from "./routes"

const query = (pairs: readonly (readonly [string, string])[]) =>
  pairs.map(([k, v]) => `${k}=${v}`).join("&")

describe("Zeitraum und Vergleich als Wert (D4)", () => {
  it("rollend, alles, frei und benannt in beide Richtungen", () => {
    const cases: [PeriodChoice, string][] = [
      [{ type: "rolling", days: 30 }, "30d"],
      [{ type: "rolling", days: 90 }, "90d"],
      [{ type: "rolling", days: 365 }, "12m"],
      [{ type: "all" }, "all"],
      [{ type: "free", from: "2026-05-01", to: "2026-06-30" }, "2026-05-01..2026-06-30"],
      [{ type: "named", id: "neue-munition" }, "neue-munition"],
    ]
    for (const [choice, text] of cases) {
      expect(encodeChoice(choice)).toBe(text)
      expect(decodeChoice(text, DEFAULT_CHOICE)).toEqual(choice)
    }
  })

  it("ein freier Zeitraum nur mit echten Tagen in der richtigen Reihenfolge, auch ein einzelner Tag", () => {
    expect(decodeChoice("2026-02-30..2026-03-01", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2026-06-30..2026-05-01", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2026-6-1..2026-06-30", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2028-02-29..2028-02-29", DEFAULT_CHOICE)).toEqual({
      type: "free",
      from: "2028-02-29",
      to: "2028-02-29",
    })
  })

  it("ein benannter Zeitraum nur als Id; die festen Werte gehen vor", () => {
    expect(decodeChoice("Neue Munition", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("-munition", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("all", DEFAULT_CHOICE)).toEqual({ type: "all" })
    expect(decodeChoice("12m", DEFAULT_CHOICE)).toEqual({ type: "rolling", days: 365 })
  })

  it("ohne Wert oder mit leerem Wert gilt die Vorgabe, auch null", () => {
    expect(decodeChoice(null, DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice(null, null)).toBeNull()
    expect(decodeChoice("7 Tage", null)).toBeNull()
    // „7d“ ist kein fester Wert, aber eine gültige Id eines benannten Zeitraums
    expect(decodeChoice("7d", null)).toEqual({ type: "named", id: "7d" })
  })

  it("Vergleich: ohne, der Zeitraum davor oder ein benannter", () => {
    expect(encodeCompare({ type: "none" })).toBeNull()
    expect(encodeCompare({ type: "previous" })).toBe("previous")
    expect(encodeCompare({ type: "named", id: "saison-2025" })).toBe("saison-2025")
    expect(decodeCompare(null)).toEqual({ type: "none" })
    expect(decodeCompare("previous")).toEqual({ type: "previous" })
    expect(decodeCompare("saison-2025")).toEqual({ type: "named", id: "saison-2025" })
    expect(decodeCompare("Saison 2025")).toEqual({ type: "none" })
  })
})

describe("Liste und Fortschritt als Query (D4)", () => {
  it("die Vorgaben ergeben keine Schlüssel, und ohne Schlüssel gelten die Vorgaben", () => {
    expect(listQueryToParams(DEFAULT_LIST)).toEqual([])
    expect(progressQueryToParams(DEFAULT_PROGRESS)).toEqual([])
    expect(listQueryFromParams(new URLSearchParams())).toEqual(DEFAULT_LIST)
    expect(progressQueryFromParams(new URLSearchParams())).toEqual(DEFAULT_PROGRESS)
  })

  it("ein voller Fortschritt in fester Reihenfolge", () => {
    const full: ProgressQuery = {
      choice: { type: "free", from: "2026-05-01", to: "2026-06-30" },
      compare: { type: "previous" },
      family: "lp-10m",
      kind: "training",
      includeProbeOnly: false,
      scoring: "rings",
      metric: "group.sigma",
      view: "months",
      chosen: "c42",
    }
    const text =
      "range=2026-05-01..2026-06-30&compare=previous&family=lp-10m&kind=training&probe=0&scoring=rings&metric=sigma&view=months&pick=c42"
    expect(query(progressQueryToParams(full))).toBe(text)
    expect(progressQueryFromParams(new URLSearchParams(text))).toEqual(full)
  })

  it("Vorgaben im Link werden gelesen und fallen beim Schreiben weg; Unbekanntes gilt als Vorgabe", () => {
    const read = progressQueryFromParams(
      new URLSearchParams("probe=1&metric=mean&range=90d&kind=wettkampf&view=jahr&pick=a b")
    )
    expect(read).toEqual(DEFAULT_PROGRESS)
    expect(progressQueryToParams(read)).toEqual([])
    expect(progressQueryFromParams(new URLSearchParams("metric=tens&scoring=zehntel")).metric).toBe(
      "result.tensRate"
    )
    expect(progressQueryFromParams(new URLSearchParams("metric=tempo")).metric).toBe(
      "time.intervalMedian"
    )
  })

  it("die Liste: ohne Zeitraum alle Abende, „all“ ebenso; Familie und Merkmal nur als Id", () => {
    const list = listQueryFromParams(
      new URLSearchParams("range=all&family=lg-10m&kind=competition&flag=nur-pdf")
    )
    expect(list).toEqual({ range: null, family: "lg-10m", kind: "competition", flag: "nur-pdf" })
    expect(query(listQueryToParams(list))).toBe("family=lg-10m&kind=competition&flag=nur-pdf")
    expect(query(listQueryToParams({ ...list, range: { type: "rolling", days: 30 } }))).toBe(
      "range=30d&family=lg-10m&kind=competition&flag=nur-pdf"
    )
    expect(listQueryFromParams(new URLSearchParams("family=LG 10m&flag=")).family).toBeNull()
  })
})
