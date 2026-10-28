import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { GoalPoint, GoalRule, GoalStand } from "../goals/measure"
import type { FamilyDefaults, GoalSummary, GoalView } from "../goals/queries"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))

const { GoalList } = await import("./GoalList")
const { GoalScreen } = await import("./GoalScreen")
const { GoalForm } = await import("./GoalForm")
const { DiaryHeader } = await import("./DiaryList")

const ZONE = "Europe/Berlin"
const LP = { id: 1, slug: "lp", name: "Luftpistole" }
const rule: GoalRule = {
  measure: "card",
  threshold: 355,
  scoring: "rings",
  shots: 40,
  cards: "training",
  from: "2026-09-01",
  to: "2027-08-31",
}
const point = (day: string, value: number): GoalPoint => ({
  cardId: day,
  day,
  startedAtMs: Date.parse(`${day}T18:00:00Z`),
  series: null,
  value,
  hit: value >= 355,
})
const stand = (extra: Partial<GoalStand> = {}): GoalStand => ({
  counted: 3,
  hits: 2,
  recent: { counted: 3, hits: 2 },
  best: point("2026-10-20", 362),
  mean: null,
  points: [point("2026-10-01", 350), point("2026-10-20", 362), point("2026-10-21", 356)],
  cards: 3,
  left: { noValue: 0, otherShots: 0, noSeries: 0 },
  ...extra,
})
const summary = (extra: Partial<GoalSummary> = {}): GoalSummary => ({
  id: "g1",
  title: "355 im Training regelmäßig",
  kind: "result",
  family: LP,
  from: "2026-09-01",
  to: "2027-08-31",
  phase: { phase: "running", months: 10 },
  outcome: null,
  rule,
  stand: stand(),
  entries: 0,
  ...extra,
})
const view = (extra: Partial<GoalView> = {}): GoalView => ({
  ...summary(),
  note: null,
  entryList: [],
  progressHref: "/progress?family=lp",
  ...extra,
})
const page = (goal: GoalView) =>
  renderToStaticMarkup(createElement(GoalScreen, { goal, marks: {}, timeZone: ZONE }))
/** die Kästen der Seite in ihrer Folge */
const boxes = (html: string) =>
  [...html.matchAll(/data-goal-(stand|note|entries|actions)/g)].map((m) => m[1])

describe("Kopf des Tagebuchs", () => {
  it("drei Reiter, der Knopf folgt dem Reiter", () => {
    const goals = renderToStaticMarkup(createElement(DiaryHeader, { current: "goals" }))
    expect(goals).toContain(">Einträge<")
    expect(goals).toContain(">Faden<")
    expect(goals).toMatch(/<a(?=[^>]*href="\/diary\/goals")(?=[^>]*aria-current="page")/)
    expect(goals).toContain('href="/diary/goals/new"')
    expect(goals).toContain("Neues Ziel")
    const entries = renderToStaticMarkup(createElement(DiaryHeader, { current: "entries" }))
    expect(entries).toContain('href="/diary/new"')
  })
})

describe("Liste der Ziele", () => {
  it("Gruppen in fester Folge, eine leere fehlt, die ganze Karte ist der Link", () => {
    const html = renderToStaticMarkup(
      createElement(GoalList, {
        groups: {
          running: [summary()],
          upcoming: [],
          past: [summary({ id: "g2", phase: { phase: "past" }, outcome: "partly" })],
        },
        timeZone: ZONE,
      })
    )
    expect([...html.matchAll(/data-goal-group="(\w+)"/g)].map((m) => m[1])).toEqual([
      "running",
      "past",
    ])
    expect(html).toMatch(/<a(?=[^>]*href="\/diary\/goals\/g1")(?=[^>]*data-goal="g1")/)
    expect(html).toContain("2 von 3 Scheiben ab 355")
    expect(html).toContain("Luftpistole · bis 31.08.2027")
    expect(html).toContain(">Teilweise<")
  })

  it("ohne Ziel der Leerzustand mit „Neues Ziel“", () => {
    const html = renderToStaticMarkup(
      createElement(GoalList, { groups: { running: [], upcoming: [], past: [] }, timeZone: ZONE })
    )
    expect(html).toContain("Noch kein Ziel")
    expect(html).toContain('href="/diary/goals/new"')
  })
})

describe("Seite eines Ziels", () => {
  it("feste Folge der Kästen für jedes Ziel", () => {
    const order = ["stand", "note", "entries", "actions"]
    expect(boxes(page(view()))).toEqual(order)
    expect(boxes(page(view({ kind: "process", rule: null, stand: null })))).toEqual(order)
    expect(boxes(page(view({ family: null, rule: null, stand: null })))).toEqual(order)
  })

  it("mit Messung: große Zahl, Kacheln, Verlauf, Link in den Fortschritt, keine Grundlage, wenn alles zählt", () => {
    const html = page(view())
    expect(html).toMatch(/data-goal-big[^>]*>.*>2<.*von 3 Scheiben ab 355 Ringen/)
    expect(html).toContain("data-goal-chart")
    expect(html).toContain("zuletzt")
    expect(html).toContain('href="/progress?family=lp"')
    expect(html).not.toContain("zählen nicht")
    expect(html).toContain("läuft · noch 10 Monate")
  })

  it("Grundlage, wenn Scheiben nicht zählen", () => {
    const html = page(
      view({ stand: stand({ cards: 5, left: { noValue: 2, otherShots: 0, noSeries: 0 } }) })
    )
    expect(html).toContain("über 5 Scheiben · 2 ohne Ergebnis zählen nicht")
  })

  it("ohne Disziplin „Disziplin festlegen“, ohne Messung „Messung festlegen“, Prozessziel nur ein Satz", () => {
    const none = page(view({ family: null, rule: null, stand: null }))
    expect(none).toContain('data-plus-row="family"')
    expect(none).toContain("Disziplin festlegen")
    expect(none).not.toContain('data-plus-row="measure"')
    const unmeasured = page(view({ rule: null, stand: null }))
    expect(unmeasured).toContain('data-plus-row="measure"')
    const process = page(view({ kind: "process", rule: null, stand: null }))
    expect(process).toContain("Ein Prozessziel misst Spiegel nicht.")
    expect(process).not.toContain('data-plus-row="measure"')
  })

  it("vor dem Beginn ein Satz statt Zahlen", () => {
    const html = page(view({ phase: { phase: "upcoming" } }))
    expect(html).toContain("Der Zeitraum beginnt am")
    expect(html).not.toContain("data-goal-big")
  })
})

describe("Formular eines Ziels", () => {
  const families: FamilyDefaults[] = [{ family: LP, scoring: "rings", shots: 40, seriesShots: 10 }]
  const seasons = {
    current: { from: "2026-09-01", to: "2027-08-31", label: "Saison 26/27" },
    next: { from: "2027-09-01", to: "2028-08-31", label: "Saison 27/28" },
  }
  const form = (goal: Parameters<typeof GoalForm>[0]["goal"]) =>
    renderToStaticMarkup(
      createElement(GoalForm, {
        goalId: goal ? "g1" : null,
        goal,
        families,
        seasons,
        timeZone: ZONE,
      })
    )

  it("neu: Saison und Disziplin vorbelegt, Messung an, Wertung und Schusszahl als eine Zeile", () => {
    const html = form(null)
    expect(html).toContain("Saison 26/27")
    expect(html).toContain("01.09.2026 bis 31.08.2027")
    expect(html).toMatch(/aria-pressed="true"[^>]*>Luftpistole</)
    expect(html).toMatch(/role="switch" aria-checked="true"/)
    expect(html).toContain("in ganzen Ringen · auf 40 Schuss")
    expect(html).toContain("Ziel anlegen")
  })

  it("Prozessziel: keine Messung", () => {
    const html = form({
      title: "Beim Schuss bleiben",
      kind: "process",
      familyId: 1,
      from: "2026-09-01",
      to: "2027-08-31",
      measure: null,
    })
    expect(html).not.toContain("data-goal-measure")
    expect(html).toContain("Speichern")
  })

  it("Ergebnisziel ohne Disziplin: Messen geht erst mit einer Disziplin", () => {
    const html = form({
      title: "Quali",
      kind: "result",
      familyId: null,
      from: "2027-03-01",
      to: "2027-06-30",
      measure: null,
    })
    expect(html).toContain("Messen geht erst mit einer Disziplin.")
    expect(html).toMatch(/role="switch" aria-checked="false"[^>]*disabled/)
  })
})
