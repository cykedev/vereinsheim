import { createElement as h } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { confirms, notices, press, render, reset } from "@/test/confirm-capture"

// Ein Wettbewerb mit Einschreibungen lässt sich nicht löschen (die Action lehnt ab). Statt einer Rückfrage, die
// danach scheitert, zeigt der Papierkorb gleich den Hinweis (Textbuch, Entscheidung E1). Wer bestätigt was, für den
// leeren Wettbewerb, steht in `../confirmations.test.tsx`.

const mocks = vi.hoisted(() => ({ deleteCompetition: vi.fn(), setCompetitionStatus: vi.fn() }))

vi.mock("react", async (original) => {
  const capture = await import("@/test/confirm-capture")
  return {
    ...(await original<typeof import("react")>()),
    useState: capture.useStateStub,
    useTransition: () => [false, capture.runTransition],
  }
})
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@vereinsheim/ui/button", async () => (await import("@/test/confirm-capture")).buttonStub())
vi.mock("@vereinsheim/ui/design2/decision-dialog", async () =>
  (await import("@/test/confirm-capture")).decisionDialogStub()
)
vi.mock("@/lib/competitions/actions", () => ({
  deleteCompetition: mocks.deleteCompetition,
  setCompetitionStatus: mocks.setCompetitionStatus,
}))

const { CompetitionActions } = await import("./CompetitionActions")

const competition = (participants: number) => ({
  id: "c1",
  name: "Rundenwettkampf 2026",
  status: "ACTIVE",
  isPublic: false,
  publicSlug: null,
  _count: { participants },
})

beforeEach(() => {
  reset()
  vi.clearAllMocks()
})

describe("Wettbewerb löschen", () => {
  it("mit Teilnehmern: nur der Hinweis, keine Bestätigung zum Löschen", () => {
    render(h(CompetitionActions, { competition: competition(6) } as never))
    press("Löschen")
    render(h(CompetitionActions, { competition: competition(6) } as never))
    expect(notices).toEqual(["„Rundenwettkampf 2026“ lässt sich hier nicht löschen"])
    // die eine Bestätigung ist die des Status (Abschließen), nicht das Löschen
    expect(confirms).toHaveLength(1)
    expect(mocks.deleteCompetition).not.toHaveBeenCalled()
  })

  it("ohne Teilnehmer: kein Hinweis, zwei Bestätigungen (Status, Löschen)", () => {
    render(h(CompetitionActions, { competition: competition(0) } as never))
    expect(notices).toEqual([])
    expect(confirms).toHaveLength(2)
  })
})
