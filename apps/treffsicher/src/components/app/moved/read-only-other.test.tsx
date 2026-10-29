import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { GoalWithAssignments } from "@/lib/goals/types"
import { MOVED_PAGES, MOVED_TEXTS, type MovedPageKind } from "@/lib/moved/texts"

// Ziele, Profil, Disziplinen und die Seiten statt der Formulare für ein Konto, das nach Spiegel umgezogen ist.

vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/goals/actions", () => ({
  deleteGoal: vi.fn(),
  updateGoal: vi.fn(),
  updateGoalAssignments: vi.fn(),
}))
vi.mock("@/lib/account/actions", () => ({ changeOwnPassword: vi.fn() }))
vi.mock("@/lib/disciplines/actions", () => ({
  createDiscipline: vi.fn(),
  updateDiscipline: vi.fn(),
}))

const { GoalCardSection } = await import("../goals/GoalCardSection")
const { ProfileScreen } = await import("../profile/ProfileScreen")
const { DisciplineForm } = await import("../disciplines/DisciplineForm")
const { MovedPage } = await import("./MovedPage")

const GOAL: GoalWithAssignments = {
  id: "g1",
  title: "380 Ringe",
  description: null,
  type: "RESULT",
  dateFrom: new Date("2026-09-01"),
  dateTo: new Date("2026-12-31"),
  sessionCount: 2,
  sessionIds: ["s1", "s2"],
}

const goal = (readOnly?: boolean) =>
  renderToStaticMarkup(
    h(GoalCardSection, {
      goal: GOAL,
      sessions: [],
      backHref: "/goals",
      displayTimeZone: "Europe/Berlin",
      readOnly,
    })
  )

const profile = (moved?: boolean) =>
  renderToStaticMarkup(
    h(ProfileScreen, { name: "Erika", email: "erika@example.test", isAdmin: false, moved })
  )

describe("Ziel nur lesend", () => {
  it("ohne Bearbeiten, Zuweisen und Löschen, mit Zurück und den Angaben", () => {
    const html = goal(true)
    expect(html).not.toContain("Ziel bearbeiten")
    expect(html).not.toContain("Einheiten zuweisen")
    expect(html).not.toContain("Ziel löschen")
    expect(html).toContain('href="/goals"')
    expect(html).toContain("380 Ringe")
  })

  it("ohne readOnly wie bisher", () => {
    const html = goal()
    expect(html).toContain("Ziel bearbeiten")
    expect(html).toContain("Ziel löschen")
  })
})

describe("Profil eines umgezogenen Kontos", () => {
  it("statt des Formulars der Satz, wo das Passwort jetzt geändert wird", () => {
    const html = profile(true)
    expect(html).not.toContain('name="currentPassword"')
    expect(html).toContain(MOVED_TEXTS.password)
    expect(html).toContain("Passwort ändern")
  })

  it("nicht umgezogen mit Formular", () => {
    expect(profile()).toContain('name="currentPassword"')
  })
})

describe("Seite statt Formular", () => {
  it.each(Object.keys(MOVED_PAGES) as MovedPageKind[])("%s", (kind) => {
    const html = renderToStaticMarkup(h(MovedPage, { kind }))
    expect(html).toContain(`data-moved-page="${kind}"`)
    expect(html).toContain(MOVED_PAGES[kind].title)
    expect(html).toContain(MOVED_TEXTS.pageTitle)
    expect(html).toContain(MOVED_PAGES[kind].text)
    expect(html).not.toContain("<form")
    expect(html).not.toContain("<a ")
  })
})

describe("Disziplin eines umgezogenen Admins", () => {
  it("legt nur Disziplinen der Anlage an, ohne Auswahl", () => {
    const html = renderToStaticMarkup(
      h(DisciplineForm, { canCreateSystem: true, systemOnly: true })
    )
    expect(html).toMatch(/<input type="hidden" name="isSystem" value="true"\/>/)
    expect(html).not.toContain("Sichtbarkeit")
  })

  it("nicht umgezogen mit Auswahl", () => {
    expect(renderToStaticMarkup(h(DisciplineForm, { canCreateSystem: true }))).toContain(
      "Sichtbarkeit"
    )
  })
})
