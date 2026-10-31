import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

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
  goalDelete,
  goalDiscard,
  goalPurgeNow,
  routineDelete,
  routineDiscard,
  routinePurgeNow,
  type Decision,
} from "./consequences"
import { LIST_TEXTS } from "./texts"

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
  ["Ziel löschen", goalDelete({ title: "355 im Training" })],
  ["Ziel endgültig", goalPurgeNow({ title: "355 im Training" })],
  ["Ziel verwerfen", goalDiscard()],
  ["Ablauf löschen", routineDelete({ name: "Mein Ablauf" })],
  ["Ablauf endgültig", routinePurgeNow({ name: "Mein Ablauf" })],
  ["Ablauf verwerfen", routineDiscard()],
]

describe("Folgen im Tagebuch", () => {
  it.each(ALL)("%s hält die Schreibregeln ein", (_, decision) => {
    for (const text of textsOf(decision)) expect(text).not.toMatch(OLD_WORDS)
  })

  it("nennt die Fragen in keinem Text „Faden“: Quellen des Tagebuchs ohne Kommentare und Tests", () => {
    const root = join(__dirname)
    const sources = [
      ...readdirSync(root, { recursive: true, encoding: "utf8" }),
      ...readdirSync(join(root, "../app/(app)/diary"), { recursive: true, encoding: "utf8" }).map(
        (file) => join("../app/(app)/diary", file)
      ),
    ].filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    const hits = sources.flatMap((file) =>
      readFileSync(join(root, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/^\s*\/\/.*$/, ""))
        .filter((line) => /Faden/.test(line))
        .map((line) => `${file}: ${line.trim()}`)
    )
    expect(sources.length).toBeGreaterThan(40)
    expect(hits).toEqual([])
    expect(LIST_TEXTS.thread).toBe("Fragen")
  })

  it("sagt beim Einschalten, wo die Scheiben dann stehen und wer das Tagebuch sieht", () => {
    expect(diaryOn().happens).toEqual([
      "In der unteren Leiste steht dann „Tagebuch“ statt „Scheiben“.",
      "Deine Scheiben findest du dann im Tagebuch unter ‚Scheiben‘. Am Computer stehen sie weiter in der Seitenleiste.",
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

  it("legt Ziel und Ablauf in den Papierkorb, Scheiben, Einträge und Fragen bleiben", () => {
    const goal = goalDelete({ title: "355 im Training" })
    expect(goal.about).toBe("Du löschst das Ziel „355 im Training“.")
    expect(goal.happens[0]).toBe(
      "Es liegt 30 Tage im Papierkorb (im Profil). So lange steht es nirgends, auch nicht auf Start."
    )
    expect(goal.notHappening).toEqual(["Scheiben und Einträge bleiben, wie sie sind."])
    const routine = routineDelete({ name: "Mein Ablauf" })
    expect(routine.about).toBe("Du löschst den Ablauf „Mein Ablauf“.")
    expect(routine.happens[0]).toBe(
      "Er liegt 30 Tage im Papierkorb (im Profil). So lange steht er nirgends, auch nicht unter „Abläufe“."
    )
    expect(routine.notHappening).toEqual(["Einträge und Fragen bleiben, wie sie sind."])
    expect(routinePurgeNow({ name: "Mein Ablauf" }).undo).toBe(
      "Das lässt sich nicht rückgängig machen."
    )
  })
})
