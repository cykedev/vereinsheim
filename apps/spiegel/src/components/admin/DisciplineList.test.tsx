import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock("@/lib/admin/discipline-actions", () => ({
  saveDiscipline: async () => ({ success: true }),
  setDisciplineIgnored: async () => ({ success: true }),
  createFamily: async () => ({ success: true }),
  renameFamily: async () => ({ success: true }),
  removeFamily: async () => ({ success: true }),
}))

const { DisciplineList } = await import("./DisciplineList")
const { DisciplineForm } = await import("./DisciplineForm")
const { FamilyForms } = await import("./FamilyForms")
const { disciplineRow } = await import("@/lib/admin/discipline-model")

const stats = {
  cards: 12,
  owners: 4,
  lastCardMonth: "Oktober 2026",
  stand: { decimal: 1, rings: 11 },
  scoredCards: 12,
  shots: { count: 40, cards: 10, of: 12 },
}
let nextId = 1
const row = (discipline: Partial<Parameters<typeof disciplineRow>[0]["discipline"]> = {}) =>
  disciplineRow({
    discipline: {
      id: nextId++,
      meytonId: 19_110_040,
      name: "LG 40 alt",
      targetId: "lg-10m",
      officialScoring: null,
      plannedShots: null,
      confirmedAt: new Date(),
      ignoredAt: null,
      family: { id: 7, name: "Luftgewehr" },
      ...discipline,
    },
    stats,
  })
const families = [
  { id: 7, slug: "lg-freihand", name: "Luftgewehr", disciplines: 3, cards: 900 },
  { id: 8, slug: "zimmerstutzen", name: "Zimmerstutzen", disciplines: 0, cards: 0 },
]

describe("Liste der Disziplinen (Markup)", () => {
  it("wartend mit Chip und „Ignorieren“, eingeordnet sichtbar ohne Chip, ohne Scheibe „wird nicht gezeigt“", () => {
    const html = renderToStaticMarkup(
      createElement(DisciplineList, {
        rows: [
          row({
            name: "Zimmerstutzen",
            meytonId: 10_199_005,
            targetId: null,
            family: null,
            confirmedAt: null,
          }),
          row({ name: "LG 40 alt" }),
          row({ name: "Eigen", targetId: null, family: null }),
        ],
      })
    )
    expect(html).toContain(">Neu<")
    expect(html).toContain(">Scheiben warten<")
    expect(html).toContain(">Ignorieren<")
    expect(html).toContain(">Luftgewehr<")
    expect(html).toContain(">Ohne Familie<")
    expect(html).toContain(">wird nicht gezeigt<")
    expect(html).toContain('href="/admin/disciplines/')
    expect(html).toContain("Nummer 10199005 · 12 Scheiben")
    // die eingeordnete sichtbare trägt keinen Chip
    const lg = html.slice(html.indexOf(">LG 40 alt<"), html.indexOf(">Ohne Familie<"))
    expect(lg).not.toContain("rounded-full")
  })

  it("Vorschlag zum Ignorieren unter „Neu“, ignorierte eingeklappt mit „Wieder zeigen“", () => {
    const html = renderToStaticMarkup(
      createElement(DisciplineList, {
        rows: [
          row({
            name: "LG Schach 6x6",
            meytonId: 18_051_010,
            targetId: null,
            family: null,
            confirmedAt: null,
            ignoredAt: new Date(),
          }),
          row({ name: "LG Training Spiegel", targetId: null, family: null, ignoredAt: new Date() }),
        ],
      })
    )
    expect(html).toContain(">Vorschlag: ignorieren<")
    expect(html).toContain("<details")
    expect(html).toContain(">Ignoriert (1)<")
    expect(html).toContain(">Wieder zeigen<")
  })
})

describe("Blatt einer Disziplin (Markup)", () => {
  it("Felder, Vorschläge und was am Stand angezeigt wurde", () => {
    const html = renderToStaticMarkup(
      createElement(DisciplineForm, { row: row({ confirmedAt: null }), families })
    )
    expect(html).toContain("Wie in der Nummer: 40")
    expect(html).toContain("Am Stand meist ganze Ringe angezeigt: 11 von 12 Scheiben.")
    expect(html).toContain(
      "So zählt Spiegel jede Scheibe dieser Disziplin, im Training wie im Wettkampf. Ein Schütze kann es an jeder Scheibe selbst umstellen."
    )
    expect(html).toContain(">Wie am Stand angezeigt<")
    expect(html).toContain('aria-label="Wertung"')
    expect(html).toContain("Vorschlag nach der Nummer: Luftgewehr 10 m")
    expect(html).toContain("zuletzt im Oktober 2026")
    expect(html).toContain(">So einordnen<")
    expect(html).toContain(">Ignorieren<")
    expect(html).toContain('aria-label="Familie"')
  })

  it("ignoriert: nur der Zustand und „Wieder zeigen“", () => {
    const html = renderToStaticMarkup(
      createElement(DisciplineForm, { row: row({ ignoredAt: new Date() }), families })
    )
    expect(html).toContain(
      "Spiegel ignoriert diese Disziplin. Ihre Scheiben zeigt Spiegel nirgends."
    )
    expect(html).toContain(">Wieder zeigen<")
    expect(html).not.toContain("So zählt Spiegel jede Scheibe")
  })

  it("Vorschlag zum Ignorieren: kein Formular, ignorieren oder wieder zeigen", () => {
    const html = renderToStaticMarkup(
      createElement(DisciplineForm, {
        row: row({
          name: "LG Schach 6x6",
          meytonId: 18_051_010,
          targetId: null,
          family: null,
          confirmedAt: null,
          ignoredAt: new Date(),
        }),
        families,
      })
    )
    expect(html).toContain("Das ist ein Spiel oder eine Trainingsscheibe von Meyton.")
    expect(html).toContain(">Ignorieren<")
    expect(html).toContain(">Wieder zeigen<")
    expect(html).not.toContain(">So einordnen<")
    expect(html).not.toContain("So zählt Spiegel jede Scheibe")
  })

  it("ohne Wertungsschüsse der Hinweis aufs Ignorieren", () => {
    const html = renderToStaticMarkup(
      createElement(DisciplineForm, {
        row: { ...row({ confirmedAt: null }), stats: { ...stats, scoredCards: 0, shots: null } },
        families,
      })
    )
    expect(html).toContain("Bisher hat keine Scheibe dieser Disziplin Wertungsschüsse.")
  })
})

describe("Familien (Markup)", () => {
  it("„Entfernen“ nur an einer leeren Familie", () => {
    const html = renderToStaticMarkup(createElement(FamilyForms, { families }))
    const used = html.slice(html.indexOf('data-family="7"'), html.indexOf('data-family="8"'))
    const empty = html.slice(html.indexOf('data-family="8"'))
    expect(used).not.toContain(">Entfernen<")
    expect(empty).toContain(">Entfernen<")
    expect(html).toContain(">Neue Familie<")
  })
})
