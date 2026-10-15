import { describe, expect, it } from "vitest"

import { GLOSSARY } from "./glossary"
import { FALLACIES, READING_GUIDE, VIEW_HELP } from "./guide"
import { HELP_TOPICS } from "./topics"

/** Texte, die ganze Sätze sind und auf ein Satzzeichen enden */
const sentences: [string, string][] = [
  ...HELP_TOPICS.flatMap((topic) =>
    (["short", "what", "read", "act", "caution", "minimum"] as const).flatMap((field) =>
      topic[field] === undefined
        ? []
        : [[`${topic.id}.${field}`, topic[field] as string] as [string, string]]
    )
  ),
  ...VIEW_HELP.flatMap((view) =>
    [view.what, view.read].flatMap((text, i) =>
      text === undefined ? [] : [[`${view.id}.${i ? "read" : "what"}`, text] as [string, string]]
    )
  ),
  ...READING_GUIDE.map((item) => [`guide: ${item.title}`, item.text] as [string, string]),
  ...FALLACIES.map((item) => [`fallacy: ${item.title}`, item.text] as [string, string]),
  ...GLOSSARY.map((entry) => [`glossary: ${entry.term}`, entry.text] as [string, string]),
]

/** alle Texte, auch Titel, Begriffe und Formeln */
const everything: [string, string][] = [
  ...sentences,
  ...HELP_TOPICS.map((topic) => [`${topic.id}.title`, topic.title] as [string, string]),
  ...HELP_TOPICS.flatMap((topic) =>
    topic.formula === undefined ? [] : [[`${topic.id}.formula`, topic.formula] as [string, string]]
  ),
  ...VIEW_HELP.map((view) => [`${view.id}.title`, view.title] as [string, string]),
  ...READING_GUIDE.map((item) => [`guide title`, item.title] as [string, string]),
  ...FALLACIES.map((item) => [`fallacy title`, item.title] as [string, string]),
  ...GLOSSARY.map((entry) => [`glossary term`, entry.term] as [string, string]),
]

describe("Stil der Texte", () => {
  it("es gibt Texte in jeder Gruppe", () => {
    expect(HELP_TOPICS.length).toBeGreaterThan(0)
    expect(VIEW_HELP.length).toBeGreaterThan(0)
    expect(READING_GUIDE.length).toBeGreaterThan(0)
    expect(FALLACIES.length).toBeGreaterThan(0)
    expect(GLOSSARY.length).toBeGreaterThan(0)
  })

  it("nicht leer, ohne Leerzeichen am Rand und ohne doppelte Leerzeichen", () => {
    for (const [where, text] of everything) {
      expect(text.trim().length, where).toBeGreaterThan(0)
      expect(text, where).toBe(text.trim())
      expect(text.includes("  "), where).toBe(false)
    }
  })

  it("deutsche Anführungszeichen und Unicode-Ellipse", () => {
    for (const [where, text] of everything) {
      expect(text.includes('"'), where).toBe(false)
      expect(text.includes("..."), where).toBe(false)
    }
  })

  it("Sätze enden mit einem Satzzeichen", () => {
    for (const [where, text] of sentences) expect(text, where).toMatch(/[.!?][“)]?$/)
  })

  it("der Satz für die Kachel ist kurz", () => {
    for (const topic of HELP_TOPICS) expect(topic.short.length, topic.id).toBeLessThanOrEqual(140)
  })

  it("keine Hinweise zum Visier", () => {
    // Spiegel rechnet, was die Lage kostet; ob und wie man etwas verstellt, sagt es nicht
    for (const [where, text] of everything) expect(text, where).not.toMatch(/Visier|Klick/)
  })

  it("Glossar-Begriffe eindeutig", () => {
    const terms = GLOSSARY.map((entry) => entry.term)
    expect(new Set(terms).size).toBe(terms.length)
  })
})
