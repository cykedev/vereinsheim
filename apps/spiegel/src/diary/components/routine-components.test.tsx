import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))

const { RoutineList } = await import("./RoutineList")
const { RoutineScreen } = await import("./RoutineScreen")
const { RoutineForm } = await import("./RoutineForm")
const { DiaryHeader } = await import("./DiaryList")

const LP = { id: 1, slug: "lp", name: "Luftpistole" }

describe("Reiter „Abläufe“", () => {
  it("vier Reiter, bei Abläufen „Neuer Ablauf“ oben", () => {
    const html = renderToStaticMarkup(createElement(DiaryHeader, { current: "routines" }))
    expect([...html.matchAll(/<a[^>]*href="(\/diary[^"]*)"/g)].map((m) => m[1])).toEqual([
      "/diary/routines/new",
      "/diary",
      "/diary/thread",
      "/diary/goals",
      "/diary/routines",
    ])
    expect(html).toMatch(/<a(?=[^>]*href="\/diary\/routines")(?=[^>]*aria-current="page")/)
    expect(html).toContain("Neuer Ablauf")
    expect(html).toContain(">Abläufe<")
  })

  it("je Disziplin eine Gruppe, „Ohne Disziplin“ zuletzt, die ganze Karte ist der Link", () => {
    const html = renderToStaticMarkup(
      createElement(RoutineList, {
        groups: [
          { family: LP, routines: [{ id: "r1", name: "Mein Ablauf", familyId: 1, steps: 7 }] },
          {
            family: null,
            routines: [{ id: "r2", name: "Stand einrichten", familyId: null, steps: 1 }],
          },
        ],
      })
    )
    expect([...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual([
      "Luftpistole",
      "Ohne Disziplin",
    ])
    expect(html).toMatch(/<a(?=[^>]*href="\/diary\/routines\/r1")(?=[^>]*data-routine="r1")/)
    expect(html).toContain("7 Schritte")
    expect(html).toContain("1 Schritt<")
  })

  it("ohne Ablauf ein Leerzustand mit „Neuer Ablauf“", () => {
    const html = renderToStaticMarkup(createElement(RoutineList, { groups: [] }))
    expect(html).toContain("Noch kein Ablauf")
    expect(html).toContain('href="/diary/routines/new"')
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
    expect(html).toContain('href="/diary/routines"')
    expect(html).toContain(">Ändern<")
    expect(html).not.toContain('data-plus-row="family"')
  })

  it("ohne Disziplin „Disziplin festlegen“ oben und „Festlegen“ in der Zeile, zurück auf „Abläufe“", () => {
    const html = renderToStaticMarkup(
      createElement(RoutineScreen, { routine: { ...routine, family: null }, families: [LP] })
    )
    expect(html).toContain('data-plus-row="family"')
    expect(html).toContain("Ohne Disziplin · 2 Schritte")
    expect(html).toContain(">Festlegen<")
    expect(html).toContain('href="/diary/routines"')
    expect(html).not.toContain("/diary/thread")
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
