import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { NamedPeriod } from "./calendar"
import { periodModel } from "./model"
import { PeriodControls, PeriodHeader } from "./PeriodHeader"
import { choiceValid, namedSpan, PeriodPicker } from "./PeriodPicker"
import { PeriodResult } from "./PeriodResult"
import { initialPeriodState, type PeriodState } from "./state"
import { NOW, periodCard, TZ } from "./testSeason"

const NAMED: NamedPeriod[] = [
  { id: "lm", name: "Vorbereitung Landesmeisterschaft", from: "2026-05-01", to: "2026-06-30" },
  { id: "muni", name: "Neue Munition", from: "2026-08-01", to: null },
]
const RANGE = { fromMs: NOW - 90 * 86_400_000, toMs: NOW + 1, label: "Letzte 90 Tage" }
const state = (partial: Partial<PeriodState> = {}) => ({
  ...initialPeriodState({ family: "lg-10m" }),
  ...partial,
})

describe("Zeitraum-Wähler (D4, D6)", () => {
  const html = renderToStaticMarkup(
    h(PeriodPicker, {
      choice: { type: "rolling", days: 90 },
      compare: { type: "none" },
      range: RANGE,
      named: NAMED,
      timeZone: TZ,
      onApply: () => {},
    })
  )

  it("Chip mit dem Namen, Blatt mit allen Vorgaben, benannten Zeiträumen, Frei und Vergleich", () => {
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>Letzte 90 Tage/)
    for (const label of [
      "Letzte 30 Tage",
      "Letzte 90 Tage",
      "Letzte 12 Monate",
      "Alles",
      "Frei",
      "Vergleichen mit",
      "Zeitraum davor",
      "Übernehmen",
    ]) {
      expect(html, label).toContain(label)
    }
    expect([...html.matchAll(/Vorbereitung Landesmeisterschaft/g)]).toHaveLength(2)
    expect(html).toContain("01.05.2026 – 30.06.2026")
    expect(html).toContain("seit 01.08.2026")
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
        onApply: () => {},
      })
    )
    const own = named.split("<label").find((l) => l.includes("der gewählte Zeitraum"))
    expect(own).toMatch(/<input type="radio" disabled=""[^>]*name="vergleich"/)
    expect(own).toContain("Vorbereitung Landesmeisterschaft")
    expect(named).toContain("Scheiben, die in beiden Zeiträumen liegen, zählen nur im gewählten.")
    expect(named).toMatch(/aria-expanded="false"/)
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

describe("Filter und Kopf (D5, D14)", () => {
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

  it("Art, nur Probe, Familie erst ab zwei Familien, Vergleich als Chip mit „×“", () => {
    const html = controls({}, null)
    expect(html).toContain('aria-label="Art"')
    expect(html).toContain("mit Training nur aus Probe")
    expect(html).not.toContain('aria-label="Familie"')
    expect(html).not.toContain("data-compare-chip")
    expect(controls({}, null, 2)).toContain('aria-label="Familie"')
    const compared = controls(
      { compare: { type: "previous" } },
      { ...RANGE, label: "Zeitraum davor" }
    )
    expect(compared).toMatch(/data-compare-chip="true"[^>]*>mit Zeitraum davor/)
    expect(compared).toContain('aria-label="Vergleich entfernen"')
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

describe("Ergebnis-Box (D13)", () => {
  const model = (cards: ReturnType<typeof periodCard>[], partial: Partial<PeriodState> = {}) =>
    periodModel({ cards, state: state(partial), nowMs: NOW, timeZone: TZ, named: NAMED })
  const render = (m: ReturnType<typeof model>) =>
    renderToStaticMarkup(
      h(PeriodResult, {
        model: m,
        timeZone: TZ,
        scoring: h("p", null, "WERTUNG"),
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
    expect(html).toContain("WERTUNG")
    expect(html).not.toContain("data-comparison")
  })

  it("mit Vergleich: Unterschied und Urteil, „?“ zum Vergleich", () => {
    const html = render(model([...now, ...before], { compare: { type: "previous" } }))
    expect(html).toMatch(
      /\+5,00<\/span> gegen Zeitraum davor · <span[^>]*>höher, besser · bedeutsam/
    )
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

  it("ohne Scheiben ein Strich", () => {
    const html = render(model([]))
    expect(html).toMatch(/data-period-result="true"[^>]*>–</)
    expect(html).toContain("keine Scheibe mit Wert")
  })
})
