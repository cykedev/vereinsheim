import { forbiddenIn } from "@vereinsheim/lib/wording"
import { describe, expect, it } from "vitest"

import {
  accountDeactivate,
  attachmentDelete,
  type Decision,
  disciplineActivate,
  disciplineArchive,
  disciplineDelete,
  goalDelete,
  leaveUnsaved,
  routineDelete,
  sessionDelete,
  TREFFSICHER_OLD_WORDS,
} from "./consequences"

const texts = (decision: Decision) => [
  decision.title,
  decision.about,
  decision.check ?? "",
  ...decision.happens,
  ...decision.notHappening,
  decision.undo,
  decision.confirmLabel,
]

/** alle Dialoge in allen Fällen, die ihr Wortlaut kennt */
const ALL: Decision[] = [
  sessionDelete({
    when: "Mi 14.10.2026 um 18:30",
    discipline: "Luftgewehr",
    type: "Training",
    attachments: 0,
    goals: 0,
  }),
  sessionDelete({
    when: "Mi 14.10.2026 um 18:30",
    discipline: null,
    type: "Mentaltraining",
    attachments: 1,
    goals: 1,
  }),
  sessionDelete({
    when: "Mi 14.10.2026 um 18:30",
    discipline: "Luftgewehr",
    type: "Training",
    attachments: 2,
    goals: 3,
  }),
  attachmentDelete({ name: "scheibe.jpg" }),
  goalDelete({ title: "380 Ringe", from: "01.09.2026", to: "31.12.2026", sessions: 0 }),
  goalDelete({ title: "380 Ringe", from: "01.09.2026", to: "31.12.2026", sessions: 1 }),
  goalDelete({ title: "380 Ringe", from: "01.09.2026", to: "31.12.2026", sessions: 4 }),
  routineDelete({ name: "Stehend", steps: 0 }),
  routineDelete({ name: "Stehend", steps: 1 }),
  routineDelete({ name: "Stehend", steps: 8 }),
  disciplineArchive({ name: "LP Auflage", system: false, favourite: false }),
  disciplineArchive({ name: "LP Auflage", system: false, favourite: true }),
  disciplineArchive({ name: "LG", system: true, favourite: false }),
  disciplineActivate({ name: "LP Auflage", system: false }),
  disciplineActivate({ name: "LG", system: true }),
  disciplineDelete({ name: "LP Auflage", system: false }),
  disciplineDelete({ name: "LG", system: true }),
  accountDeactivate({ name: "Erika Muster", email: "erika@example.org" }),
  accountDeactivate({ name: null, email: "erika@example.org" }),
  leaveUnsaved(),
]

describe("Schreibregeln", () => {
  it("kein Semikolon, keine drei Punkte, keins der alten Wörter", () => {
    expect(forbiddenIn(ALL.flatMap(texts), TREFFSICHER_OLD_WORDS)).toEqual([])
  })

  it("jeder Dialog sagt, worum es geht, was passiert und wie es zurückgeht", () => {
    for (const decision of ALL) {
      expect(decision.title).toMatch(/\?$/)
      expect(decision.about).not.toBe("")
      expect(decision.happens.length).toBeGreaterThan(0)
      expect(decision.notHappening.length).toBeGreaterThan(0)
      expect(decision.undo).not.toBe("")
      expect(texts(decision).join(" ")).not.toMatch(/undefined|null|\{|\}/)
    }
  })

  it("die alten Texte fallen durch", () => {
    expect(
      forbiddenIn(
        ["Diese Aktion kann nicht rückgängig gemacht werden.", "Nutzer deaktivieren?"],
        TREFFSICHER_OLD_WORDS
      )
    ).toHaveLength(2)
  })
})

describe("Wortlaut wie im Textbuch", () => {
  it("Einheit löschen mit Anhängen und Zielen", () => {
    expect(
      sessionDelete({
        when: "Mi 14.10.2026 um 18:30",
        discipline: "Luftgewehr (Zehntel)",
        type: "Training",
        attachments: 2,
        goals: 2,
      })
    ).toEqual({
      title: "Einheit vom Mi 14.10.2026 um 18:30 löschen?",
      about:
        "Die Einheit vom Mi 14.10.2026 um 18:30 steht in deinem Tagebuch. Luftgewehr (Zehntel), Training.",
      happens: [
        "Die Einheit verschwindet aus dem Tagebuch und aus der Statistik.",
        "Mit ihr gehen die Serien und Schüsse, das Befinden, die Prognose, das Feedback und die Reflexion.",
        "Die 2 angehängten Dateien werden gelöscht.",
        "2 Ziele zählen diese Einheit nicht mehr mit.",
      ],
      notHappening: ["Die Ziele selbst bleiben. Die Disziplin und deine Abläufe bleiben."],
      undo: "Nicht möglich. Die Einheit lässt sich nur neu erfassen.",
      confirmLabel: "Einheit löschen",
      destructive: true,
    })
  })

  it("Einheit löschen ohne Anhänge und Ziele: keine Zeilen dazu", () => {
    const decision = sessionDelete({
      when: "x",
      discipline: null,
      type: "Mentaltraining",
      attachments: 0,
      goals: 0,
    })
    expect(decision.happens).toHaveLength(2)
    expect(decision.about).toBe("Die Einheit vom x steht in deinem Tagebuch. Mentaltraining.")
  })

  it("Anhang löschen", () => {
    expect(attachmentDelete({ name: "scheibe.jpg" })).toMatchObject({
      title: "Anhang „scheibe.jpg“ löschen?",
      about: "Die Datei „scheibe.jpg“ hängt an dieser Einheit.",
      happens: ["Die Datei wird gelöscht und verschwindet aus der Einheit."],
      confirmLabel: "Anhang löschen",
    })
  })

  it("Ziel löschen mit zugeordneten Einheiten", () => {
    expect(
      goalDelete({
        title: "380 Ringe im Wettkampf",
        from: "01.09.2026",
        to: "31.12.2026",
        sessions: 4,
      })
    ).toMatchObject({
      title: "Ziel „380 Ringe im Wettkampf“ löschen?",
      about: "Das Ziel gilt vom 01.09.2026 bis 31.12.2026. 4 Einheiten sind ihm zugeordnet.",
      happens: ["Das Ziel verschwindet unter „Ziele“.", "Die 4 Einheiten zeigen es nicht mehr an."],
    })
    expect(goalDelete({ title: "x", from: "a", to: "b", sessions: 0 }).happens).toEqual([
      "Das Ziel verschwindet unter „Ziele“.",
    ])
  })

  it("Ablauf löschen", () => {
    expect(routineDelete({ name: "Luftgewehr stehend", steps: 8 }).about).toBe(
      "Der Ablauf „Luftgewehr stehend“ beschreibt deinen Schuss in 8 Schritten."
    )
  })

  it("Disziplin archivieren: eigene mit Favorit, Standarddisziplin für alle", () => {
    expect(
      disciplineArchive({ name: "LP Auflage", system: false, favourite: true }).happens
    ).toEqual([
      "Bei einer neuen Einheit und einem neuen Ablauf steht sie nicht mehr zur Auswahl.",
      "Sie ist danach nicht mehr deine Lieblingsdisziplin.",
    ])
    expect(disciplineArchive({ name: "LG", system: true, favourite: false })).toMatchObject({
      title: "Standarddisziplin „LG“ archivieren?",
      about: "„LG“ ist eine Standarddisziplin. Alle Konten sehen sie.",
    })
  })

  it("Disziplin aktivieren fragt ohne Warnfarbe", () => {
    expect(disciplineActivate({ name: "LG", system: true })).toMatchObject({
      happens: [
        "Bei einer neuen Einheit und einem neuen Ablauf steht sie wieder zur Auswahl. Das gilt für alle Konten.",
      ],
      destructive: false,
    })
  })

  it("Disziplin löschen", () => {
    expect(disciplineDelete({ name: "LP Auflage", system: false }).about).toBe(
      "Keine Einheit und kein Ablauf verwendet „LP Auflage“. Nur deshalb lässt sie sich löschen."
    )
  })

  it("Konto deaktivieren, ohne Namen mit der E-Mail-Adresse", () => {
    expect(accountDeactivate({ name: "Erika Muster", email: "erika@example.org" })).toMatchObject({
      title: "Konto von Erika Muster deaktivieren?",
      about: "Erika Muster meldet sich mit erika@example.org an.",
      happens: [
        "Erika Muster kann sich nicht mehr anmelden.",
        "Ist Erika Muster gerade angemeldet, endet das beim nächsten Klick.",
      ],
    })
    expect(accountDeactivate({ name: null, email: "erika@example.org" }).title).toBe(
      "Konto von erika@example.org deaktivieren?"
    )
  })

  it("Ohne Speichern verlassen", () => {
    expect(leaveUnsaved()).toMatchObject({
      title: "Ohne Speichern verlassen?",
      undo: "Nicht möglich. Mit „Abbrechen“ bleibst du hier und kannst speichern.",
      confirmLabel: "Verwerfen",
    })
  })
})
