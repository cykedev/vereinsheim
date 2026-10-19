import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { NamedPeriod } from "./calendar"
import { periodModel } from "./model"
import { PeriodControls, PeriodHeader } from "./PeriodHeader"
import { choiceValid, filterSummary, namedSpan, PeriodPicker } from "./PeriodPicker"
import { PeriodResult } from "./PeriodResult"
import { initialPeriodState, type PeriodState } from "./state"
import { item, NOW, periodCard, TZ } from "./testSeason"

const NAMED: NamedPeriod[] = [
  { id: "lm", name: "Vorbereitung Landesmeisterschaft", from: "2026-05-01", to: "2026-06-30" },
  { id: "muni", name: "Neue Munition", from: "2026-08-01", to: null },
]
const RANGE = { fromMs: NOW - 90 * 86_400_000, toMs: NOW + 1, label: "Letzte 90 Tage" }
const state = (partial: Partial<PeriodState> = {}) => ({
  ...initialPeriodState({ family: "lg-10m" }),
  ...partial,
})

describe("Blatt „Filter“", () => {
  const html = renderToStaticMarkup(
    h(PeriodPicker, {
      choice: { type: "rolling", days: 90 },
      compare: { type: "none" },
      range: RANGE,
      named: NAMED,
      timeZone: TZ,
      kind: "all",
      includeProbeOnly: true,
      onApply: () => {},
    })
  )

  it("Chip mit dem Namen, Blatt mit allen Vorgaben, benannten Zeiträumen, Frei und Vergleich", () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>Letzte 90 Tage/)
    for (const label of [
      "Letzte 30 Tage",
      "Letzte 90 Tage",
      "Letzte 6 Monate",
      "Letzte 12 Monate",
      "Alles",
      "Frei",
      "Vergleichen mit",
      "Zeitraum davor",
      "Übernehmen",
      "Trainings nur aus Probe mitzählen",
    ]) {
      expect(html, label).toContain(label)
    }
    expect([...html.matchAll(/Vorbereitung Landesmeisterschaft/g)]).toHaveLength(2)
    expect(html).toContain("01.05.2026 – 30.06.2026")
    expect(html).toContain("seit 01.08.2026")
    // auch Art und Probe-Training im Blatt, als Entwurf bis „Übernehmen“; das Blatt heißt „Filter“
    expect(html).toMatch(/<legend[^>]*>Art<\/legend>/)
    expect([...html.matchAll(/<input type="radio"[^>]*name="art"/g)]).toHaveLength(3)
    for (const label of ["Alle", "Training", "Wettkampf"])
      expect(html).toContain(`<span>${label}</span>`)
    expect(html).toMatch(/<input type="checkbox"[^>]*checked=""/)
    expect(html).toContain(">Filter<")
    // „Frei“ beginnt mit den Tagen des Zeitraums, die Felder sind aus, solange „Frei“ nicht gewählt ist
    expect(html).toMatch(/type="date" disabled=""[^>]*value="2026-07-02"/)
  })

  it("ein benannter Zeitraum ist kein Vergleich mit sich selbst", () => {
    const named = renderToStaticMarkup(
      h(PeriodPicker, {
        choice: { type: "named", id: "lm" },
        compare: { type: "none" },
        range: RANGE,
        named: NAMED,
        timeZone: TZ,
        kind: "all",
        includeProbeOnly: true,
        onApply: () => {},
      })
    )
    const own = named.split("<label").find((l) => l.includes("der gewählte Zeitraum"))
    expect(own).toMatch(/<input type="radio" disabled=""[^>]*name="vergleich"/)
    expect(own).toContain("Vorbereitung Landesmeisterschaft")
    expect(named).toContain("Scheiben, die in beiden Zeiträumen liegen, zählen nur im gewählten.")
    expect(named).toMatch(/aria-expanded="false"/)
  })

  it("der Chip fasst zusammen, was von der Vorgabe abweicht", () => {
    const base = { kind: "all", compareLabel: null, includeProbeOnly: true } as const
    expect(filterSummary("Letzte 90 Tage", base)).toBe("Letzte 90 Tage")
    expect(filterSummary("Letzte 90 Tage", { ...base, kind: "training" })).toBe(
      "Letzte 90 Tage · Training"
    )
    expect(filterSummary("Letzte 90 Tage", { ...base, compareLabel: "Zeitraum davor" })).toBe(
      "Letzte 90 Tage · mit Zeitraum davor"
    )
    expect(
      filterSummary("Alles", { kind: "competition", compareLabel: null, includeProbeOnly: false })
    ).toBe("Alles · Wettkampf · ohne Probe-Training")
  })

  it("Frei nur mit zwei Tagen, von nicht nach bis", () => {
    expect(choiceValid({ type: "rolling", days: 30 })).toBe(true)
    expect(choiceValid({ type: "free", from: "2026-07-01", to: "2026-07-31" })).toBe(true)
    expect(choiceValid({ type: "free", from: "2026-07-01", to: "2026-07-01" })).toBe(true)
    expect(choiceValid({ type: "free", from: "2026-08-01", to: "2026-07-31" })).toBe(false)
    expect(choiceValid({ type: "free", from: "", to: "2026-07-31" })).toBe(false)
    expect(namedSpan(NAMED[1], TZ)).toBe("seit 01.08.2026")
  })
})

describe("Filter und Kopf", () => {
  const controls = (
    partial: Partial<PeriodState>,
    compareRange: typeof RANGE | null,
    families = 1
  ) =>
    renderToStaticMarkup(
      h(PeriodControls, {
        state: state(partial),
        dispatch: () => {},
        range: RANGE,
        compareRange,
        named: NAMED,
        timeZone: TZ,
        families: [
          { value: "lg-10m", label: "Luftgewehr" },
          { value: "lp-10m", label: "Luftpistole" },
        ].slice(0, families),
      })
    )

  it("ein weiterer Chip in der Zeile nach dem Chip „Filter“, wie in der Liste", () => {
    const html = renderToStaticMarkup(
      h(PeriodControls, {
        state: state({}),
        dispatch: () => {},
        range: RANGE,
        compareRange: null,
        named: NAMED,
        timeZone: TZ,
        families: [{ value: "lg-10m", label: "Luftgewehr" }],
        actions: h("span", { "data-kreis": true }),
      })
    )
    expect(html).toMatch(/data-period-controls[^>]*class="flex flex-wrap items-center gap-2"/)
    expect(html).toMatch(
      /<div data-period-actions="true" class="flex items-center gap-1\.5"><span data-kreis/
    )
    expect(html.indexOf("data-kreis")).toBeGreaterThan(html.indexOf("data-period-chip"))
    expect(controls({}, null)).not.toContain("data-period-actions")
  })

  it("eine Zeile: Familie (erst ab zwei) und der Chip; Art, Probe-Training und Vergleich im Blatt", () => {
    const html = controls({}, null)
    expect(html).not.toContain('aria-label="Art"')
    expect(html).not.toContain("mit Training nur aus Probe")
    expect(html).not.toContain('aria-label="Familie"')
    expect(html).not.toContain("data-compare-chip")
    expect(html).toMatch(/data-period-chip="true"[^>]*>Letzte 90 Tage</)
    const two = controls({}, null, 2)
    expect(two).toContain('aria-label="Familie"')
    // die Familie vor dem Chip
    expect(two.indexOf('aria-label="Familie"')).toBeLessThan(two.indexOf("data-period-chip"))
    const compared = controls(
      { compare: { type: "previous" }, kind: "training" },
      { ...RANGE, label: "Zeitraum davor" }
    )
    expect(compared).toMatch(
      /data-period-chip="true"[^>]*>Letzte 90 Tage · Training · mit Zeitraum davor</
    )
    expect(compared).not.toContain('aria-label="Vergleich entfernen"')
  })

  it("Kopf: Titel, Metazeile, Filter, Ergebnis nur auf dem Telefon, Satz", () => {
    const html = renderToStaticMarkup(
      h(PeriodHeader, {
        title: "Letzte 90 Tage",
        meta: ["Luftgewehr", "12 Scheiben"],
        controls: h("p", null, "FILTER"),
        result: h("p", null, "ERGEBNIS"),
        sentence: "Ein Satz.",
      })
    )
    expect(html).toContain("<h1")
    expect(html).toContain("Luftgewehr · 12 Scheiben")
    expect(html).toContain("FILTER")
    expect(html).toMatch(/<div class="md:hidden"><p>ERGEBNIS/)
    expect(html).toMatch(/data-sentence="true"[^>]*>Ein Satz\./)
  })
})

describe("Ergebnis-Box", () => {
  const model = (cards: ReturnType<typeof periodCard>[], partial: Partial<PeriodState> = {}) =>
    periodModel({
      items: cards.map(item),
      state: state(partial),
      nowMs: NOW,
      timeZone: TZ,
      named: NAMED,
    })
  const render = (m: ReturnType<typeof model>) =>
    renderToStaticMarkup(
      h(PeriodResult, {
        model: m,
        timeZone: TZ,
        onHelp: () => {},
      })
    )
  const now = [60, 70, 80, 90, 100].map((t, i) => periodCard(`n${i}`, 10 + i, [t, t]))
  const before = [10, 20, 30, 40, 50].map((t, i) => periodCard(`v${i}`, 100 + i, [t, t]))

  it("Ø der Scheiben groß, Scheiben und Wertungsschüsse, beste Scheibe mit Schusszahl", () => {
    const html = render(model(now))
    expect(html).toMatch(/data-period-result="true"[^>]*>8,00<small/)
    expect(html).toContain("5 Scheiben · 10 Wertungsschüsse")
    // die beste (10,0) ist die älteste der fünf, 14 Tage vor jetzt
    expect(html).toMatch(/beste Scheibe zu 2 Schuss [\s\S]*10,00[\s\S]*am 16\.09\.2026/)
    // keine Kreise in der Box: die Wertung der Familie steht in der Zeile der Filter
    expect(html).not.toContain("data-scoring-toggle")
    expect(html).not.toContain("data-comparison")
  })

  it("mit Vergleich: Unterschied und Urteil, „?“ zum Vergleich", () => {
    const html = render(model([...now, ...before], { compare: { type: "previous" } }))
    expect(html).toMatch(/\+5,00<\/span> gegen Zeitraum davor · <span[^>]*>deutlich besser/)
    expect(html).toContain('data-help="zeitraum-vergleich"')
  })

  it("überlappende Zeiträume: die gemeinsamen Scheiben zählen nur im Zeitraum", () => {
    const html = render(
      model([...now, ...before], {
        choice: { type: "rolling", days: 365 },
        compare: { type: "named", id: "lm" },
      })
    )
    // „Vorbereitung“ (Mai, Juni) enthält v0 … v4 (100 bis 104 Tage vor jetzt): alle auch im Jahr
    expect(html).toContain("5 Scheiben liegen in beiden Zeiträumen und zählen nur hier.")
    expect(html).toContain("gegen Vorbereitung Landesmeisterschaft: zu wenige Scheiben")
  })

  it("ohne Schalter der Wertung (die Wertung des Geräts) kein leerer Platz", () => {
    const html = renderToStaticMarkup(h(PeriodResult, { model: model(now), timeZone: TZ }))
    expect(html).not.toContain("WERTUNG")
    expect(html).toMatch(/<\/p><\/div><\/div>$/)
  })

  it("ohne Scheiben ein Strich", () => {
    const html = render(model([]))
    expect(html).toMatch(/data-period-result="true"[^>]*>–</)
    expect(html).toContain("keine Scheibe mit Wert")
  })
})
