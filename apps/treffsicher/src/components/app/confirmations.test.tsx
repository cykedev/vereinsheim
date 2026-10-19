import { createElement as h, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { leaveUnsaved } from "@/lib/consequences"
import { confirms, reset, settle } from "@/test/confirm-capture"

// Der Wortlaut der Dialoge ist hier gleichgültig (eigener Test in `lib/consequences.test.ts`).
// Welche Action läuft nach dem Bestätigen, mit welchen Werten, genau einmal, und wohin geht es danach. Die Tests
// gelten vor und nach dem Umbau auf `DecisionDialog` (Stellvertreter in `@/test/confirm-capture`).

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  deleteSession: vi.fn(),
  deleteShotRoutine: vi.fn(),
  deleteDiscipline: vi.fn(),
  setDisciplineArchived: vi.fn(),
  deleteGoal: vi.fn(),
}))

vi.mock("react", async (original) => {
  const { runTransition } = await import("@/test/confirm-capture")
  return {
    ...(await original<typeof import("react")>()),
    useTransition: () => [false, runTransition],
  }
})
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@vereinsheim/ui/alert-dialog", async () =>
  (await import("@/test/confirm-capture")).alertDialogStub()
)
vi.mock("@vereinsheim/ui/design2/decision-dialog", async () =>
  (await import("@/test/confirm-capture")).decisionDialogStub()
)
vi.mock("@vereinsheim/ui/shell/ConfirmDialog", async () =>
  (await import("@/test/confirm-capture")).confirmDialogStub()
)
vi.mock("@/lib/sessions/actions", () => ({ deleteSession: mocks.deleteSession }))
vi.mock("@/lib/shot-routines/actions", () => ({ deleteShotRoutine: mocks.deleteShotRoutine }))
vi.mock("@/lib/disciplines/actions", () => ({
  deleteDiscipline: mocks.deleteDiscipline,
  setDisciplineArchived: mocks.setDisciplineArchived,
}))
vi.mock("@/lib/goals/actions", () => ({
  deleteGoal: mocks.deleteGoal,
  updateGoal: vi.fn(),
  updateGoalAssignments: vi.fn(),
}))

const { DeleteSessionButton } = await import("./sessions/DeleteSessionButton")
const { DeleteShotRoutineButton } = await import("./shot-routines/DeleteShotRoutineButton")
const { DeleteDisciplineButton } = await import("./disciplines/DeleteDisciplineButton")
const { ArchiveDisciplineButton } = await import("./disciplines/ArchiveDisciplineButton")
const { GoalCardSection } = await import("./goals/GoalCardSection")
const { DiscardChangesDialog } = await import("./shell/DiscardChangesDialog")

/** rendert, bestätigt den einzigen Dialog und wartet, bis die Action durch ist */
async function confirm<P extends object>(component: ComponentType<P>, props: P) {
  renderToStaticMarkup(h(component as ComponentType<object>, props))
  expect(confirms).toHaveLength(1)
  confirms[0]()
  await settle()
}

beforeEach(() => {
  reset()
  vi.clearAllMocks()
  for (const action of [
    mocks.deleteSession,
    mocks.deleteShotRoutine,
    mocks.deleteDiscipline,
    mocks.setDisciplineArchived,
    mocks.deleteGoal,
  ])
    action.mockResolvedValue({ success: true })
})

describe("Bestätigen löst genau eine Action aus", () => {
  it("Einheit löschen: deleteSession mit der Id, danach ins Tagebuch", async () => {
    await confirm(DeleteSessionButton, { sessionId: "s1", decision: leaveUnsaved() })
    expect(mocks.deleteSession).toHaveBeenCalledTimes(1)
    expect(mocks.deleteSession).toHaveBeenCalledWith("s1")
    expect(mocks.push).toHaveBeenCalledWith("/sessions")
  })

  it("Einheit löschen mit Fehler: bleibt auf der Seite", async () => {
    mocks.deleteSession.mockResolvedValue({ error: "Einheit nicht gefunden" })
    await confirm(DeleteSessionButton, { sessionId: "s1", decision: leaveUnsaved() })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("Ablauf löschen: deleteShotRoutine mit der Id, danach zu den Abläufen", async () => {
    await confirm(DeleteShotRoutineButton, { routineId: "r1", decision: leaveUnsaved() })
    expect(mocks.deleteShotRoutine).toHaveBeenCalledTimes(1)
    expect(mocks.deleteShotRoutine).toHaveBeenCalledWith("r1")
    expect(mocks.push).toHaveBeenCalledWith("/shot-routines")
  })

  it("Disziplin löschen: deleteDiscipline mit der Id, danach zu den Disziplinen", async () => {
    await confirm(DeleteDisciplineButton, { disciplineId: "d1", decision: leaveUnsaved() })
    expect(mocks.deleteDiscipline).toHaveBeenCalledTimes(1)
    expect(mocks.deleteDiscipline).toHaveBeenCalledWith("d1")
    expect(mocks.push).toHaveBeenCalledWith("/disciplines")
  })

  it("Disziplin löschen mit Fehler: bleibt auf der Seite", async () => {
    mocks.deleteDiscipline.mockResolvedValue({ error: "wird verwendet" })
    await confirm(DeleteDisciplineButton, { disciplineId: "d1", decision: leaveUnsaved() })
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("Disziplin archivieren: setDisciplineArchived(id, true), danach neu laden", async () => {
    await confirm(ArchiveDisciplineButton, {
      disciplineId: "d1",
      isArchived: false,
      decision: leaveUnsaved(),
    })
    expect(mocks.setDisciplineArchived).toHaveBeenCalledTimes(1)
    expect(mocks.setDisciplineArchived).toHaveBeenCalledWith("d1", true)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it("Disziplin aktivieren: setDisciplineArchived(id, false)", async () => {
    await confirm(ArchiveDisciplineButton, {
      disciplineId: "d1",
      isArchived: true,
      decision: leaveUnsaved(),
    })
    expect(mocks.setDisciplineArchived).toHaveBeenCalledTimes(1)
    expect(mocks.setDisciplineArchived).toHaveBeenCalledWith("d1", false)
  })

  it("Ziel löschen: deleteGoal mit der Id, danach neu laden", async () => {
    await confirm(GoalCardSection, {
      goal: {
        id: "g1",
        title: "380 Ringe",
        description: null,
        type: "RESULT",
        dateFrom: new Date("2026-09-01"),
        dateTo: new Date("2026-12-31"),
        sessionCount: 2,
        sessionIds: ["s1", "s2"],
      },
      sessions: [],
      displayTimeZone: "Europe/Berlin",
    })
    expect(mocks.deleteGoal).toHaveBeenCalledTimes(1)
    expect(mocks.deleteGoal).toHaveBeenCalledWith("g1")
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it("Ohne Speichern verlassen: bestätigt einmal, bricht nicht ab", async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    await confirm(DiscardChangesDialog, { open: true, onConfirm, onCancel })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
