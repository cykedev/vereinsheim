import { describe, expect, it } from "vitest"

import { treffsicherAccount } from "./treffsicher-export"

const session = {
  id: "ses1",
  date: "2026-03-13T18:00:00.000Z",
  type: "TRAINING",
  location: "Schützenhaus",
  trainingGoal: "Abzug",
  isFavourite: true,
  discipline: { name: "Luftpistole", scoringType: "WHOLE", shotsPerSeries: 10 },
  hitLocation: { xMm: 1.5, yMm: 2, horizontal: "LEFT", vertical: "HIGH" },
  wellbeing: { sleep: 70, energy: 50, stress: 30, motivation: 90 },
  prognosis: null,
  feedback: null,
  reflection: {
    observations: "ruhig",
    insight: null,
    learningQuestion: null,
    routineDeviation: null,
  },
  series: [{ position: 1, isPractice: false, scoreTotal: 90, shots: ["9"], executionQuality: 4 }],
  attachments: [
    {
      id: "att1",
      filePath: "0b6e2a1c-5f0e-4c4e-9d55-3f0b1e2c4d5a.pdf",
      fileType: "PDF",
      originalName: "Ausdruck.pdf",
      createdAt: "2026-03-13T19:00:00.000Z",
    },
  ],
}

const account = (over: Record<string, unknown> = {}) => ({
  user: {
    id: "usr1",
    name: "Erfunden",
    email: "erfunden@example.com",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
    isActive: true,
    movedToSpiegelAt: null,
  },
  sessions: [session],
  goals: [
    {
      id: "goa1",
      title: "380 Ringe",
      description: null,
      type: "RESULT",
      dateFrom: "2026-01-01T00:00:00.000Z",
      dateTo: "2026-06-30T00:00:00.000Z",
      sessionIds: ["ses1"],
    },
  ],
  routines: [
    {
      id: "rou1",
      name: "Vor dem Schuss",
      discipline: null,
      steps: [{ order: 1, title: "Atmen" }],
    },
  ],
  ...over,
})

const withPath = (filePath: string) =>
  account({ sessions: [{ ...session, attachments: [{ ...session.attachments[0], filePath }] }] })

describe("treffsicherAccount", () => {
  it("nimmt ein Konto mit allen Teilen", () => {
    const parsed = treffsicherAccount.parse(account())
    expect(parsed.user).toMatchObject({ id: "usr1", isActive: true, movedToSpiegelAt: null })
    expect(parsed.sessions[0].attachments[0]).toMatchObject({ fileType: "PDF" })
    expect(parsed.goals[0].sessionIds).toEqual(["ses1"])
    expect(parsed.routines[0].steps).toEqual([{ order: 1, title: "Atmen" }])
  })

  it("nimmt ein umgezogenes Konto mit Zeitpunkt", () => {
    const moved = account({
      user: { ...account().user, movedToSpiegelAt: "2026-10-29T20:00:00.000Z" },
    })
    expect(treffsicherAccount.parse(moved).user.movedToSpiegelAt).toBe("2026-10-29T20:00:00.000Z")
  })

  it.each([
    "../geheim.pdf",
    "a/../../geheim.pdf",
    "/etc/passwd",
    "a//b.pdf",
    "datei mit leerzeichen.pdf",
    "",
  ])("lehnt den Pfad %j ab", (filePath) => {
    expect(treffsicherAccount.safeParse(withPath(filePath)).success).toBe(false)
  })

  it("nimmt einen Pfad in einem Unterordner", () => {
    expect(treffsicherAccount.safeParse(withPath("2026/03/datei.jpg")).success).toBe(true)
  })

  it("lehnt Kennungen mit Zeichen ab, die in eine Abfrage reichen könnten", () => {
    expect(
      treffsicherAccount.safeParse(account({ sessions: [{ ...session, id: "a,b" }] })).success
    ).toBe(false)
    const goal = { ...account().goals[0], sessionIds: ["x'y"] }
    expect(treffsicherAccount.safeParse(account({ goals: [goal] })).success).toBe(false)
  })

  it("verlangt einen Passwort-Hash", () => {
    const user = { ...account().user, passwordHash: "" }
    expect(treffsicherAccount.safeParse(account({ user })).success).toBe(false)
  })
})
