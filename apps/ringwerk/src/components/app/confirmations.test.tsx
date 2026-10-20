import { createElement as h, type ComponentType } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buttons, confirms, press, render, reset, settle, type } from "@/test/confirm-capture"

// Der Wortlaut der Dialoge ist hier gleichgültig (eigener Test in `lib/consequences.test.ts`). Hier steht, welche Action
// nach dem Bestätigen läuft, mit welchen Werten, genau einmal, und was danach passiert. Ringwerk trägt den
// Wettkampfbetrieb: Diese Tests galten vor dem Umbau auf `DecisionDialog` und gelten unverändert danach (Stellvertreter
// in `@/test/confirm-capture`). Props, die erst der neue Dialog braucht (Namen, Runden), gibt jeder Test schon mit.

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  deleteEventSeries: vi.fn(),
  deleteSeasonSeries: vi.fn(),
  setParticipantActive: vi.fn(),
  deleteParticipant: vi.fn(),
  revokeWithdrawal: vi.fn(),
  unenrollParticipant: vi.fn(),
  setDisciplineArchived: vi.fn(),
  deleteDiscipline: vi.fn(),
  setCompetitionStatus: vi.fn(),
  deleteCompetition: vi.fn(),
  forceDeleteCompetition: vi.fn(),
  startPlayoffs: vi.fn(),
  advanceRound: vi.fn(),
  deleteLastPlayoffDuel: vi.fn(),
  addPlayoffDuel: vi.fn(),
  deleteLatestBestOfDuel: vi.fn(),
  setUserActive: vi.fn(),
  generateCompetitionSchedule: vi.fn(),
  navConfirm: vi.fn(),
  navCancel: vi.fn(),
}))

vi.mock("react", async (original) => {
  const capture = await import("@/test/confirm-capture")
  return {
    ...(await original<typeof import("react")>()),
    useState: capture.useStateStub,
    useTransition: () => [false, capture.runTransition],
  }
})
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh, back: mocks.back }),
}))
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))
vi.mock("@vereinsheim/ui/button", async () => (await import("@/test/confirm-capture")).buttonStub())
vi.mock("@vereinsheim/ui/input", async () => (await import("@/test/confirm-capture")).inputStub())
vi.mock("@vereinsheim/ui/alert-dialog", async () =>
  (await import("@/test/confirm-capture")).alertDialogStub()
)
vi.mock("@vereinsheim/ui/design2/decision-dialog", async () =>
  (await import("@/test/confirm-capture")).decisionDialogStub()
)
vi.mock("@vereinsheim/ui/dialog", async () => {
  const { Fragment } = await import("react")
  const pass = ({ children }: { children?: unknown }) => h(Fragment, null, children as never)
  return {
    Dialog: pass,
    DialogContent: pass,
    DialogFooter: pass,
    DialogHeader: pass,
    DialogTitle: pass,
    DialogDescription: pass,
    DialogTrigger: pass,
  }
})

vi.mock("@/lib/series/actions", () => ({
  deleteEventSeries: mocks.deleteEventSeries,
  deleteSeasonSeries: mocks.deleteSeasonSeries,
}))
vi.mock("@/lib/participants/actions", () => ({
  setParticipantActive: mocks.setParticipantActive,
  deleteParticipant: mocks.deleteParticipant,
}))
vi.mock("@/lib/competitionParticipants/actions", () => ({
  withdrawParticipant: vi.fn(),
  revokeWithdrawal: mocks.revokeWithdrawal,
  unenrollParticipant: mocks.unenrollParticipant,
  updateParticipantDiscipline: vi.fn(),
}))
vi.mock("@/lib/disciplines/actions", () => ({
  setDisciplineArchived: mocks.setDisciplineArchived,
  deleteDiscipline: mocks.deleteDiscipline,
}))
vi.mock("@/lib/competitions/actions", () => ({
  setCompetitionStatus: mocks.setCompetitionStatus,
  deleteCompetition: mocks.deleteCompetition,
  forceDeleteCompetition: mocks.forceDeleteCompetition,
}))
vi.mock("@/lib/playoffs/actions", () => ({
  startPlayoffs: mocks.startPlayoffs,
  advanceRound: mocks.advanceRound,
  deleteLastPlayoffDuel: mocks.deleteLastPlayoffDuel,
  addPlayoffDuel: mocks.addPlayoffDuel,
}))
vi.mock("@/lib/results/bestOfActions", () => ({
  deleteLatestBestOfDuel: mocks.deleteLatestBestOfDuel,
  saveBestOfDuel: vi.fn(),
  saveStechschuss: vi.fn(),
}))
vi.mock("@/lib/users/actions", () => ({ setUserActive: mocks.setUserActive }))
vi.mock("@/lib/matchups/actions", () => ({
  generateCompetitionSchedule: mocks.generateCompetitionSchedule,
}))

// Bausteine neben den Dialogen, die hier nichts beitragen
const none = () => null
vi.mock("@/components/app/participants/row-actions/ParticipantEditDialog", () => ({
  ParticipantEditDialog: none,
}))
vi.mock("@/components/app/competitionParticipants/participant-actions/WithdrawDialog", () => ({
  WithdrawDialog: none,
}))
vi.mock(
  "@/components/app/competitionParticipants/participant-actions/DisciplineEditDialog",
  () => ({
    DisciplineEditDialog: none,
  })
)
vi.mock("@/components/app/playoffs/PlayoffDuelResultDialog", () => ({
  PlayoffDuelResultDialog: none,
}))
vi.mock("@/components/app/matchups/best-of-entry/DuelInputPanels", () => ({
  DuelInputPanels: none,
}))
vi.mock("@/components/app/matchups/best-of-entry/RecordedDuelsList", () => ({
  RecordedDuelsList: none,
}))
vi.mock("@/components/app/matchups/best-of-entry/RunningScore", () => ({ RunningScore: none }))
vi.mock("@/components/app/competitions/competition-form", () => ({
  BasicFieldsSection: none,
  EventFieldsSection: none,
  LeagueFieldsSection: none,
  PublishSection: none,
  SeasonFieldsSection: none,
  useCompetitionFormState: () => ({
    router: { back: mocks.back },
    formAction: vi.fn(),
    isPending: false,
    markDirty: vi.fn(),
    setSubmitted: vi.fn(),
    generalError: null,
    nav: {
      isConfirmOpen: true,
      confirm: mocks.navConfirm,
      cancel: mocks.navCancel,
      requestNavigation: vi.fn(),
    },
  }),
}))

const { DeleteEventSeriesButton } = await import("./series/DeleteEventSeriesButton")
const { DeleteSeasonSeriesButton } = await import("./series/DeleteSeasonSeriesButton")
const { ParticipantRowActions } = await import("./participants/ParticipantRowActions")
const { CompetitionParticipantActions } =
  await import("./competitionParticipants/CompetitionParticipantActions")
const { DisciplineActions } = await import("./disciplines/DisciplineActions")
const { CompetitionActions } = await import("./competitions/CompetitionActions")
const { ForceDeleteCompetitionSection } =
  await import("./competitions/ForceDeleteCompetitionSection")
const { StartPlayoffsButton } = await import("./playoffs/StartPlayoffsButton")
const { AdvanceRoundButton } = await import("./playoffs/AdvanceRoundButton")
const { PlayoffMatchCard } = await import("./playoffs/PlayoffMatchCard")
const { BestOfEntryDialog } = await import("./matchups/BestOfEntryDialog")
const { UserRowActions } = await import("./users/UserRowActions")
const { GenerateScheduleButton } = await import("./matchups/GenerateScheduleButton")
const { CompetitionForm } = await import("./competitions/CompetitionForm")

const ACTIONS = [
  mocks.deleteEventSeries,
  mocks.deleteSeasonSeries,
  mocks.setParticipantActive,
  mocks.deleteParticipant,
  mocks.revokeWithdrawal,
  mocks.unenrollParticipant,
  mocks.setDisciplineArchived,
  mocks.deleteDiscipline,
  mocks.setCompetitionStatus,
  mocks.deleteCompetition,
  mocks.forceDeleteCompetition,
  mocks.startPlayoffs,
  mocks.advanceRound,
  mocks.deleteLastPlayoffDuel,
  mocks.addPlayoffDuel,
  mocks.deleteLatestBestOfDuel,
  mocks.setUserActive,
  mocks.generateCompetitionSchedule,
]

/** rendert die Komponente mit Props, die sie (heute oder nach dem Umbau) versteht */
const show = (component: unknown, props: object) =>
  render(h(component as ComponentType<object>, props))

/** bestätigt die Bestätigung an dieser Stelle im Markup und wartet, bis die Action durch ist */
async function confirmAt(index: number) {
  expect(confirms[index]).toBeDefined()
  expect(confirms[index].disabled).toBe(false)
  confirms[index].run()
  await settle()
}

/** keine Action außer den genannten lief */
function onlyCalled(...called: ReturnType<typeof vi.fn>[]) {
  for (const action of ACTIONS) if (!called.includes(action)) expect(action).not.toHaveBeenCalled()
}

beforeEach(() => {
  reset()
  vi.clearAllMocks()
  for (const action of ACTIONS) action.mockResolvedValue({ success: true })
})

describe("Ergebnisse", () => {
  it("Ergebnis im Event löschen: deleteEventSeries(Serie, Wettbewerb)", async () => {
    show(DeleteEventSeriesButton, {
      seriesId: "s1",
      competitionId: "c1",
      name: "Anna Birke",
      teams: false,
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.deleteEventSeries).toHaveBeenCalledTimes(1)
    expect(mocks.deleteEventSeries).toHaveBeenCalledWith("s1", "c1")
    onlyCalled(mocks.deleteEventSeries)
  })

  it("Serie in der Saison löschen: deleteSeasonSeries(Serie, Wettbewerb)", async () => {
    show(DeleteSeasonSeriesButton, {
      seriesId: "s2",
      competitionId: "c1",
      name: "Anna Birke",
      date: "12.10.2026",
      minSeries: 10,
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.deleteSeasonSeries).toHaveBeenCalledTimes(1)
    expect(mocks.deleteSeasonSeries).toHaveBeenCalledWith("s2", "c1")
    onlyCalled(mocks.deleteSeasonSeries)
  })
})

describe("Teilnehmer (Liste aller Teilnehmer)", () => {
  const row = {
    participantId: "p1",
    firstName: "Anna",
    lastName: "Birke",
    contact: null,
    isAdmin: false,
    competitionsCount: 0,
  }

  it("aktiv: nur Deaktivieren, setParticipantActive(id, false)", async () => {
    show(ParticipantRowActions, { ...row, isActive: true })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.setParticipantActive).toHaveBeenCalledTimes(1)
    expect(mocks.setParticipantActive).toHaveBeenCalledWith("p1", false)
    onlyCalled(mocks.setParticipantActive)
  })

  it("inaktiv: Aktivieren, setParticipantActive(id, true)", async () => {
    show(ParticipantRowActions, { ...row, isActive: false })
    expect(confirms).toHaveLength(2)
    await confirmAt(0)
    expect(mocks.setParticipantActive).toHaveBeenCalledTimes(1)
    expect(mocks.setParticipantActive).toHaveBeenCalledWith("p1", true)
    onlyCalled(mocks.setParticipantActive)
  })

  it("inaktiv, in keinem Wettbewerb: deleteParticipant(id, false)", async () => {
    show(ParticipantRowActions, { ...row, isActive: false })
    await confirmAt(1)
    expect(mocks.deleteParticipant).toHaveBeenCalledTimes(1)
    expect(mocks.deleteParticipant).toHaveBeenCalledWith("p1", false)
    onlyCalled(mocks.deleteParticipant)
  })

  it("inaktiv, in Wettbewerben, Sportleitung: kein Löschen", () => {
    show(ParticipantRowActions, { ...row, isActive: false, competitionsCount: 3 })
    expect(confirms).toHaveLength(1)
    confirms[0].run()
    expect(mocks.deleteParticipant).not.toHaveBeenCalled()
  })

  it("inaktiv, in Wettbewerben, Admin: erst mit dem Nachnamen, dann deleteParticipant(id, true)", async () => {
    show(ParticipantRowActions, { ...row, isActive: false, isAdmin: true, competitionsCount: 3 })
    expect(confirms).toHaveLength(2)
    expect(confirms[1].disabled).toBe(true)
    type("confirm-participant-name", "Birk")
    show(ParticipantRowActions, { ...row, isActive: false, isAdmin: true, competitionsCount: 3 })
    expect(confirms[1].disabled).toBe(true)
    type("confirm-participant-name", " Birke ")
    show(ParticipantRowActions, { ...row, isActive: false, isAdmin: true, competitionsCount: 3 })
    await confirmAt(1)
    expect(mocks.deleteParticipant).toHaveBeenCalledTimes(1)
    expect(mocks.deleteParticipant).toHaveBeenCalledWith("p1", true)
    onlyCalled(mocks.deleteParticipant)
  })
})

describe("Teilnehmer eines Wettbewerbs", () => {
  const entry = (status: "ACTIVE" | "WITHDRAWN") => ({
    id: "cp1",
    status,
    isGuest: false,
    withdrawnAt: status === "WITHDRAWN" ? new Date("2026-10-12T10:00:00Z") : null,
    disciplineId: null,
    teamNumber: null,
    seriesCount: 0,
    participant: { id: "p1", firstName: "Anna", lastName: "Birke", contact: null },
  })

  it("zurückgezogen: Rückzug zurücknehmen, revokeWithdrawal(Einschreibung)", async () => {
    show(CompetitionParticipantActions, {
      entry: entry("WITHDRAWN"),
      playoffsStarted: false,
      displayTimeZone: "Europe/Berlin",
    })
    expect(confirms).toHaveLength(2)
    await confirmAt(0)
    expect(mocks.revokeWithdrawal).toHaveBeenCalledTimes(1)
    expect(mocks.revokeWithdrawal).toHaveBeenCalledWith("cp1")
    onlyCalled(mocks.revokeWithdrawal)
  })

  it("Entfernen: unenrollParticipant(Einschreibung)", async () => {
    show(CompetitionParticipantActions, {
      entry: entry("ACTIVE"),
      playoffsStarted: false,
      displayTimeZone: "Europe/Berlin",
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.unenrollParticipant).toHaveBeenCalledTimes(1)
    expect(mocks.unenrollParticipant).toHaveBeenCalledWith("cp1")
    onlyCalled(mocks.unenrollParticipant)
  })

  it("nach dem Start der Playoffs: keine Bestätigung", () => {
    show(CompetitionParticipantActions, {
      entry: entry("WITHDRAWN"),
      playoffsStarted: true,
      displayTimeZone: "Europe/Berlin",
    })
    expect(confirms).toHaveLength(0)
  })
})

describe("Disziplinen und Konten", () => {
  const discipline = {
    id: "d1",
    name: "Luftgewehr Auflage",
    scoringType: "DECIMAL",
    teilerFaktor: 1.8,
    isSystem: false,
    isArchived: false,
  }

  it("Disziplin löschen: deleteDiscipline(id), Archivieren fragt nicht", async () => {
    show(DisciplineActions, { discipline })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.deleteDiscipline).toHaveBeenCalledTimes(1)
    expect(mocks.deleteDiscipline).toHaveBeenCalledWith("d1")
    onlyCalled(mocks.deleteDiscipline)
  })

  it("Konto deaktivieren: setUserActive(id, false)", async () => {
    show(UserRowActions, {
      userId: "u1",
      userName: "Erika Muster",
      email: "erika@example.org",
      isActive: true,
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.setUserActive).toHaveBeenCalledTimes(1)
    expect(mocks.setUserActive).toHaveBeenCalledWith("u1", false)
    onlyCalled(mocks.setUserActive)
  })

  it("Konto aktivieren: setUserActive(id, true)", async () => {
    show(UserRowActions, {
      userId: "u1",
      userName: null,
      email: "erika@example.org",
      isActive: false,
    })
    await confirmAt(0)
    expect(mocks.setUserActive).toHaveBeenCalledWith("u1", true)
    onlyCalled(mocks.setUserActive)
  })
})

describe("Wettbewerbe", () => {
  const competition = (status: "ACTIVE" | "COMPLETED" | "ARCHIVED", participants = 0) => ({
    id: "c1",
    name: "Rundenwettkampf 2026",
    status,
    isPublic: false,
    publicSlug: null,
    _count: { participants },
  })

  it.each([
    ["ACTIVE", "Als abgeschlossen markieren", "COMPLETED"],
    ["COMPLETED", "Wieder öffnen", "ACTIVE"],
    ["COMPLETED", "Archivieren", "ARCHIVED"],
    ["ARCHIVED", "Wiederherstellen", "COMPLETED"],
  ] as const)("Status %s, Knopf „%s“: setCompetitionStatus(id, %s)", async (from, button, to) => {
    show(CompetitionActions, { competition: competition(from) })
    press(button)
    show(CompetitionActions, { competition: competition(from) })
    await confirmAt(0)
    expect(mocks.setCompetitionStatus).toHaveBeenCalledTimes(1)
    expect(mocks.setCompetitionStatus).toHaveBeenCalledWith("c1", to)
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1)
    onlyCalled(mocks.setCompetitionStatus)
  })

  it("Wettbewerb ohne Einschreibung löschen: deleteCompetition(id)", async () => {
    show(CompetitionActions, { competition: competition("ACTIVE") })
    press("Löschen")
    show(CompetitionActions, { competition: competition("ACTIVE") })
    await confirmAt(confirms.length - 1)
    expect(mocks.deleteCompetition).toHaveBeenCalledTimes(1)
    expect(mocks.deleteCompetition).toHaveBeenCalledWith("c1")
    onlyCalled(mocks.deleteCompetition)
  })

  it("mit allen Daten löschen: erst mit dem Namen, dann forceDeleteCompetition(id, Name) und zur Liste", async () => {
    const props = { competitionId: "c1", competitionName: "Rundenwettkampf 2026", isPublic: false }
    show(ForceDeleteCompetitionSection, props)
    expect(confirms).toHaveLength(1)
    expect(confirms[0].disabled).toBe(true)
    type("confirm-competition-name", "Rundenwettkampf 2026")
    show(ForceDeleteCompetitionSection, props)
    await confirmAt(0)
    expect(mocks.forceDeleteCompetition).toHaveBeenCalledTimes(1)
    expect(mocks.forceDeleteCompetition).toHaveBeenCalledWith("c1", "Rundenwettkampf 2026")
    expect(mocks.push).toHaveBeenCalledWith("/competitions")
    onlyCalled(mocks.forceDeleteCompetition)
  })

  it("mit allen Daten löschen, abgelehnt: bleibt auf der Seite", async () => {
    mocks.forceDeleteCompetition.mockResolvedValue({ error: "Keine Berechtigung" })
    const props = { competitionId: "c1", competitionName: "Rundenwettkampf 2026", isPublic: false }
    show(ForceDeleteCompetitionSection, props)
    type("confirm-competition-name", "Rundenwettkampf 2026")
    show(ForceDeleteCompetitionSection, props)
    await confirmAt(0)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("Spielplan generieren: generateCompetitionSchedule(id)", async () => {
    show(GenerateScheduleButton, {
      competitionId: "c1",
      hasSchedule: false,
      leagueFormat: "DOUBLE_ROUND_ROBIN",
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.generateCompetitionSchedule).toHaveBeenCalledTimes(1)
    expect(mocks.generateCompetitionSchedule).toHaveBeenCalledWith("c1")
    onlyCalled(mocks.generateCompetitionSchedule)
  })

  it("Spielplan neu generieren: generateCompetitionSchedule(id)", async () => {
    show(GenerateScheduleButton, {
      competitionId: "c1",
      hasSchedule: true,
      leagueFormat: "BEST_OF_SINGLE",
    })
    await confirmAt(0)
    expect(mocks.generateCompetitionSchedule).toHaveBeenCalledTimes(1)
    expect(mocks.generateCompetitionSchedule).toHaveBeenCalledWith("c1")
  })

  it("Ohne Speichern verlassen: bestätigt einmal, bricht nicht ab", async () => {
    show(CompetitionForm, { disciplines: [], action: vi.fn() })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.navConfirm).toHaveBeenCalledTimes(1)
    expect(mocks.navCancel).not.toHaveBeenCalled()
  })
})

describe("Playoffs und Best-of", () => {
  it("Playoffs starten: startPlayoffs(id)", async () => {
    show(StartPlayoffsButton, {
      competitionId: "c1",
      name: "Rundenwettkampf 2026",
      round: "Viertelfinale",
      active: 11,
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.startPlayoffs).toHaveBeenCalledTimes(1)
    expect(mocks.startPlayoffs).toHaveBeenCalledWith("c1")
    onlyCalled(mocks.startPlayoffs)
  })

  it("nächste Runde anlegen: advanceRound(id)", async () => {
    show(AdvanceRoundButton, {
      competitionId: "c1",
      label: "Halbfinale anlegen",
      round: "Halbfinale",
      previous: "Viertelfinale",
    })
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.advanceRound).toHaveBeenCalledTimes(1)
    expect(mocks.advanceRound).toHaveBeenCalledWith("c1")
    onlyCalled(mocks.advanceRound)
  })

  it("Duell in den Playoffs löschen: deleteLastPlayoffDuel(letztes Duell), danach neu laden", async () => {
    const result = (participantId: string, totalRings: number) => ({
      participantId,
      totalRings,
      teiler: 50,
      ringteiler: 60,
    })
    const props = {
      canManage: true,
      config: {
        scoringType: "WHOLE",
        shotsPerSeries: 10,
        playoffBestOf: 5,
        finalePrimary: "RINGS",
        finaleTiebreaker1: null,
        finaleTiebreaker2: null,
      },
      match: {
        id: "m1",
        round: "SEMI_FINAL",
        status: "COMPLETED",
        winsA: 3,
        winsB: 1,
        canCorrect: true,
        participantA: { id: "pa", firstName: "Anna", lastName: "Birke" },
        participantB: { id: "pb", firstName: "Bert", lastName: "Eiche" },
        duels: [1, 2, 3, 4].map((n) => ({
          id: `d${n}`,
          duelNumber: n,
          isSuddenDeath: false,
          isCompleted: true,
          winnerId: n === 2 ? "pb" : "pa",
          resultA: result("pa", 95),
          resultB: result("pb", 94),
        })),
      },
    }
    show(PlayoffMatchCard, props)
    expect(buttons.filter((b) => b.name === "")).toHaveLength(1)
    press("")
    show(PlayoffMatchCard, props)
    await confirmAt(0)
    expect(mocks.deleteLastPlayoffDuel).toHaveBeenCalledTimes(1)
    expect(mocks.deleteLastPlayoffDuel).toHaveBeenCalledWith("d4")
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    onlyCalled(mocks.deleteLastPlayoffDuel)
  })

  it("Best-of: letztes Duell zurücknehmen, deleteLatestBestOfDuel(Paarung)", async () => {
    const series = (participantId: string, duelNumber: number, rings: number) => ({
      id: `${participantId}-${duelNumber}`,
      participantId,
      duelNumber,
      isTiebreak: false,
      rings,
      teiler: 40,
      ringteiler: 60,
      disciplineId: null,
    })
    const props = {
      matchupId: "mu1",
      homeParticipant: { id: "pa", firstName: "Anna", lastName: "Birke" },
      awayParticipant: { id: "pb", firstName: "Bert", lastName: "Eiche" },
      series: [series("pa", 1, 96), series("pb", 1, 94)],
      canManage: true,
      hasResults: true,
      scoringMode: "RINGTEILER",
      disciplineId: null,
      groupBestOf: 3,
      groupPlayAllDuels: false,
      groupTiebreaker1: null,
      groupTiebreaker2: null,
      shotsPerSeries: 10,
      scoringType: "WHOLE",
      teilerFaktor: 1,
    }
    show(BestOfEntryDialog, props)
    press("Letztes Duell/Stechschuss zurücknehmen")
    show(BestOfEntryDialog, props)
    expect(confirms).toHaveLength(1)
    await confirmAt(0)
    expect(mocks.deleteLatestBestOfDuel).toHaveBeenCalledTimes(1)
    expect(mocks.deleteLatestBestOfDuel).toHaveBeenCalledWith("mu1")
    onlyCalled(mocks.deleteLatestBestOfDuel)
  })
})
