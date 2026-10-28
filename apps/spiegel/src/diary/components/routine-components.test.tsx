import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))

const { ThreadView } = await import("./ThreadView")
const { RoutineScreen } = await import("./RoutineScreen")
const { RoutineForm } = await import("./RoutineForm")

const LP = { id: 1, slug: "lp", name: "Luftpistole" }
const thread = (extra: Partial<Parameters<typeof ThreadView>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ThreadView, {
      families: [LP],
      family: LP,
      withoutFamily: false,
      noFamily: false,
      items: [],
      routines: [{ id: "r1", name: "Mein Ablauf", familyId: 1, steps: 7 }],
      timeZone: "Europe/Berlin",
      ...extra,
    })
  )

describe("Faden mit Abläufen", () => {
  it("der Kasten „Abläufe“ steht über den Fragen, jede Zeile ist der Link, „+“ legt für die Disziplin an", () => {
    const html = thread()
    expect(html.indexOf("data-routine-box")).toBeLessThan(html.indexOf("Noch keine Frage"))
    expect(html).toMatch(/<a(?=[^>]*href="\/diary\/routines\/r1")(?=[^>]*data-routine="r1")/)
    expect(html).toContain("7 Schritte")
    expect(html).toContain('href="/diary/routines/new?family=lp"')
  })

  it("ohne Ablauf eine Zeile mit „+“ und Satz", () => {
    expect(thread({ routines: [] })).toContain(
      "Noch kein Ablauf für Luftpistole. Schreib auf, wie du einen Schuss aufbaust."
    )
  })

  it("ein Ablauf ohne Disziplin verschwindet nicht: Chip „Ohne Disziplin“ mit seinen Abläufen und ohne Fragen", () => {
    const chips = thread({ withoutFamily: true })
    expect(chips).toContain('href="/diary/thread?family=none"')
    expect(chips).toContain(">Ohne Disziplin<")
    const none = thread({
      family: null,
      withoutFamily: true,
      noFamily: true,
      routines: [{ id: "r2", name: "Stand einrichten", familyId: null, steps: 2 }],
    })
    expect(none).toContain("Stand einrichten")
    expect(none).toContain("Abläufe ohne Disziplin. Mit einer Disziplin stehen sie in deren Faden.")
    expect(none).toContain('href="/diary/routines/new"')
    expect(none).not.toContain("Noch keine Frage")
  })
})

describe("Ein Ablauf", () => {
  const routine = {
    id: "r1",
    name: "Mein Ablauf",
    family: LP,
    steps: [{ title: "Griff fassen", description: "Hand hoch.\nErst fühlen." }, { title: "Atmen" }],
  }

  it("nummerierte Schritte, Erklärung mit Zeilenumbruch, Zeilen in „Dieser Ablauf“", () => {
    const html = renderToStaticMarkup(createElement(RoutineScreen, { routine, families: [LP] }))
    expect(html).toContain("Luftpistole · 2 Schritte")
    expect([...html.matchAll(/aria-hidden="true"[^>]*>(\d+)<\/span>/g)].map((m) => m[1])).toEqual([
      "1",
      "2",
    ])
    expect(html).toContain("whitespace-pre-line")
    expect(html).toContain('href="/diary/routines/r1/edit"')
    expect(html).toContain(">Ändern<")
    expect(html).not.toContain('data-plus-row="family"')
  })

  it("ohne Disziplin „Disziplin festlegen“ oben und „Festlegen“ in der Zeile, zurück unter „Ohne Disziplin“", () => {
    const html = renderToStaticMarkup(
      createElement(RoutineScreen, { routine: { ...routine, family: null }, families: [LP] })
    )
    expect(html).toContain('data-plus-row="family"')
    expect(html).toContain("Ohne Disziplin · 2 Schritte")
    expect(html).toContain(">Festlegen<")
    expect(html).toContain('href="/diary/thread?family=none"')
  })

  it("Bearbeiten: ein Textfeld und der Hinweis zählt die Schritte", () => {
    const html = renderToStaticMarkup(
      createElement(RoutineForm, {
        routine: { id: "r1", name: "Mein Ablauf", family: LP, text: "Griff\nHand hoch.\n\nAtmen" },
        families: [],
        familyId: null,
      })
    )
    expect(html).toContain("data-routine-text")
    expect(html).toContain("Gerade: 2 Schritte.")
    expect(html).toContain(">Speichern<")
  })
})
