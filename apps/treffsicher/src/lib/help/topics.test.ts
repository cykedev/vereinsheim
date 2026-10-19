import { forbiddenIn } from "@vereinsheim/lib/wording"
import { HELP_FIELDS } from "@vereinsheim/ui/design2/help"
import { describe, expect, it } from "vitest"

import { TREFFSICHER_OLD_WORDS } from "@/lib/consequences"

import { HELP_TOPICS, helpTopic } from "./topics"

const topics = Object.values(HELP_TOPICS)

describe("Hilfe-Themen", () => {
  it("jedes Thema hat Titel, Kurzsatz und „Was es ist“", () => {
    for (const topic of topics) {
      expect(topic.title).not.toBe("")
      expect(topic.short).not.toBe("")
      expect(topic.what).not.toBe("")
    }
  })

  it("Schreibregeln in allen Feldern", () => {
    const texts = topics.flatMap((topic) =>
      [
        topic.title,
        topic.short,
        ...HELP_FIELDS.map(([key]) => (topic as Record<string, string>)[key]),
      ].filter((text): text is string => typeof text === "string")
    )
    expect(texts.length).toBeGreaterThan(8)
    expect(forbiddenIn(texts, TREFFSICHER_OLD_WORDS)).toEqual([])
  })

  it("findet ein Thema, unbekannt und ohne Schlüssel nichts", () => {
    expect(helpTopic("wellbeing")?.title).toBe("Befinden")
    expect(helpTopic("prognosis-feedback")?.title).toBe("Prognose und Feedback")
    expect(helpTopic("unbekannt")).toBeNull()
    expect(helpTopic(null)).toBeNull()
  })
})
