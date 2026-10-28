import { describe, expect, it } from "vitest"

import { OLD_WORDS } from "@/lib/admin/consequences"

import {
  diaryCardRelease,
  diaryDiscard,
  diaryEntryDelete,
  diaryEntryPurgeNow,
  diaryOff,
  diaryOn,
  diarySectionRemove,
  type Decision,
} from "./consequences"

const textsOf = (decision: Decision) => [
  decision.title,
  decision.about,
  ...(decision.check ? [decision.check] : []),
  ...decision.happens,
  ...decision.notHappening,
  decision.undo,
  decision.confirmLabel,
]

const ALL: [string, Decision][] = [
  ["einschalten", diaryOn()],
  ["ausschalten", diaryOff()],
  ["lösen", diaryCardRelease({ when: "Fr 13.03.2026 · 19:55", executions: 0 })],
  ["lösen mit Ausführung", diaryCardRelease({ when: "Fr 13.03.2026 · 19:55", executions: 4 })],
  ["entfernen", diarySectionRemove({ name: "Befinden", day: "Fr 13.03." })],
  ["löschen", diaryEntryDelete({ day: "Fr 13.03.", family: "Luftpistole" })],
  ["löschen ohne Disziplin", diaryEntryDelete({ day: "Mi 21.10.", family: null })],
  ["endgültig", diaryEntryPurgeNow({ day: "Fr 13.03." })],
  ["verwerfen", diaryDiscard()],
]

describe("Folgen im Tagebuch", () => {
  it.each(ALL)("%s hält die Schreibregeln ein", (_, decision) => {
    for (const text of textsOf(decision)) expect(text).not.toMatch(OLD_WORDS)
  })

  it("sagt beim Einschalten, wo die Scheiben dann stehen und wer das Tagebuch sieht", () => {
    expect(diaryOn().happens).toEqual([
      "In der unteren Leiste steht dann „Tagebuch“ statt „Scheiben“.",
      "Alle Scheiben findest du dann im Profil und über Start. Am Computer stehen sie weiter in der Seitenleiste.",
      "Nur du siehst dein Tagebuch. Der Admin sieht nichts davon.",
    ])
  })

  it("sagt beim Ausschalten, dass die Einträge bleiben", () => {
    expect(diaryOff().notHappening[0]).toBe(
      "Deine Einträge bleiben gespeichert. Sie sind nur nicht zu sehen."
    )
    expect(diaryOff().destructive).toBe(false)
  })

  it("nennt beim Lösen die Ausführung nur, wenn es eine gibt, und ist nur dann destruktiv", () => {
    const plain = diaryCardRelease({ when: "Fr 13.03.2026 · 19:55", executions: 0 })
    const rated = diaryCardRelease({ when: "Fr 13.03.2026 · 19:55", executions: 2 })
    expect(plain.about).toBe("Du nimmst die Scheibe vom Fr 13.03.2026 um 19:55 aus diesem Eintrag.")
    expect(plain.happens).toHaveLength(1)
    expect(rated.happens).toContain("Deine Bewertung ihrer Serien (Ausführung) ist dann weg.")
    expect([plain.destructive, rated.destructive]).toEqual([false, true])
  })

  it("legt einen Eintrag in den Papierkorb, die Scheiben bleiben", () => {
    const decision = diaryEntryDelete({ day: "Fr 13.03.", family: "Luftpistole" })
    expect(decision.about).toBe("Du löschst den Eintrag vom Fr 13.03. (Luftpistole).")
    expect(decision.happens[0]).toMatch(/^Er liegt 30 Tage im Papierkorb/)
    expect(decision.notHappening[0]).toBe("Die Scheiben bleiben in Spiegel, mit allen Schüssen.")
  })
})
