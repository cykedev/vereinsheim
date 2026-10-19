import { forbiddenIn } from "@vereinsheim/lib/wording"
import { HELP_FIELDS } from "@vereinsheim/ui/design2/help"
import { describe, expect, it } from "vitest"

import { TREFFSICHER_OLD_WORDS } from "@/lib/consequences"

import { STATISTICS_TILES } from "@/lib/statistics/page"

import { HELP_TOPICS, helpHeading, helpTopic, metricHelpId } from "./topics"

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

  it("jedes „?“ der Statistik hat ein eigenes Thema, keins aus Spiegel", () => {
    // die Ids, nach denen die Bausteine der Seite eines Zeitraums fragen, und die Kennzahlen der Kacheln
    const ids = [
      "verlauf-und-form",
      "trainingsumfang",
      "zeitraum-vergleich",
      "gegen-den-schnitt",
      "rekorde",
      "einfluesse",
      "selbstbild",
      ...STATISTICS_TILES.map((key) => metricHelpId(key)),
    ]
    for (const id of ids) {
      expect(id).not.toBeNull()
      expect(helpTopic(id)?.title).toBeTruthy()
      expect(JSON.stringify(helpTopic(id))).not.toMatch(
        /Scheiben\b|Spiegel|Ellipse|Kalender|Probe mitz/
      )
    }
    expect(helpHeading("lage-echt").title).toBe("Schwerpunkt-Abstand")
    expect(() => helpHeading("ringverteilung")).toThrow()
  })

  it("findet ein Thema, unbekannt und ohne Schlüssel nichts", () => {
    expect(helpTopic("wellbeing")?.title).toBe("Befinden")
    expect(helpTopic("prognosis-feedback")?.title).toBe("Prognose und Feedback")
    expect(helpTopic("unbekannt")).toBeNull()
    expect(helpTopic(null)).toBeNull()
  })
})
