import { readFileSync } from "node:fs"
import path from "node:path"

import { forbiddenIn } from "@vereinsheim/lib/wording"
import { HELP_FIELDS, type HelpText } from "@vereinsheim/ui/design2/help"
import { describe, expect, it } from "vitest"

import { RINGWERK_OLD_WORDS } from "@/lib/consequences"

import { HELP_TOPICS, helpTopic } from "./topics"

const topics: HelpText[] = Object.values(HELP_TOPICS)

/** alle Texte eines Themas: Titel, Kurzsatz, die Felder des Blatts und die Formel */
const textsOf = (topic: HelpText): string[] =>
  [topic.title, topic.short, ...HELP_FIELDS.map(([key]) => topic[key]), topic.formula].filter(
    (text): text is string => typeof text === "string"
  )

/** das Textbuch ohne Zeilenumbrüche und Einzug, damit umbrochene Sätze als ein Satz gefunden werden */
const textbook = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../../../vault/_attachments/textbuch-ringwerk-treffsicher.md"
  ),
  "utf8"
)
  .split("## Ringwerk: Hilfe (WD0)")[1]
  .split("\n---\n")[0]
  .replace(/\s+/g, " ")

describe("Hilfe-Themen", () => {
  it("jedes Thema hat Titel, Kurzsatz und „Was es ist“", () => {
    for (const topic of topics) {
      expect(topic.title).not.toBe("")
      expect(topic.short).not.toBe("")
      expect(topic.what).not.toBe("")
    }
  })

  it("Schreibregeln in allen Feldern", () => {
    const texts = topics.flatMap(textsOf)
    expect(texts.length).toBeGreaterThan(30)
    expect(forbiddenIn(texts, RINGWERK_OLD_WORDS)).toEqual([])
    // „K.O.-Phase“ ist ein altes Wort; auch „K.-o.“ und „Tiebreaker“ stehen in keiner Erklärung
    expect(texts.filter((text) => /K\.-?[oO]\.|Tiebreak/.test(text))).toEqual([])
  })

  it("jeder Text steht so im freigegebenen Textbuch", () => {
    for (const topic of topics) {
      for (const text of textsOf(topic)) expect(textbook).toContain(text)
    }
  })

  it("findet ein Thema, unbekannt und ohne Schlüssel nichts", () => {
    expect(helpTopic("ringteiler")?.title).toBe("Ringteiler")
    expect(helpTopic("corrected-teiler")?.title).toBe("Korrigierter Teiler")
    expect(helpTopic("unbekannt")).toBeNull()
    expect(helpTopic(null)).toBeNull()
  })
})
