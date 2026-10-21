import { describe, expect, it } from "vitest"

import {
  GUIDE_END,
  GUIDE_START,
  guideSection,
  renderGuideMarkdown,
  renderTopic,
  replaceGuideSection,
  wrapText,
} from "./markdown"
import type { HelpTopic } from "./types"

describe("wrapText", () => {
  it("bricht an Leerzeichen um, Folgezeilen eingerückt, keine Zeile über der Breite", () => {
    expect(wrapText("- eins zwei drei vier", 12, "  ")).toBe("- eins zwei\n  drei vier")
    expect(wrapText("kurz", 12, "  ")).toBe("kurz")
    // genau so breit wie erlaubt bleibt auf einer Zeile
    expect(wrapText("abcde fghij", 11, "")).toBe("abcde fghij")
  })

  it("ein Wort, das länger als die Breite ist, steht allein auf seiner Zeile", () => {
    expect(wrapText("a Donaudampfschifffahrt b", 10, "")).toBe("a\nDonaudampfschifffahrt\nb")
  })
})

describe("renderTopic", () => {
  const full: HelpTopic = {
    id: "beispiel",
    title: "Beispiel",
    theme: "result",
    catalog: ["E1", "E2"],
    metrics: ["result.decimal"],
    short: "Kurz.",
    what: "Was es misst.",
    read: "Wie man es liest.",
    act: "Was man tut.",
    caution: "Wo man sich täuscht.",
    minimum: "Ab 1 Schuss.",
    formula: "x = y",
  }

  it("ein Thema mit allen Feldern ergibt genau diesen Block", () => {
    expect(renderTopic(full)).toBe(
      [
        "**Beispiel (E1, E2)**",
        "- *Was:* Was es misst.",
        "- *So liest du es:* Wie man es liest.",
        "- *Was du tun kannst:* Was man tut.",
        "- *Vorsicht:* Wo man sich täuscht.",
        "- *Mindestzahl:* Ab 1 Schuss.",
        "- *Formel:* `x = y`",
      ].join("\n")
    )
  })

  it("fehlende Felder fehlen auch im Block; ohne Katalog-IDs kein Klammerzusatz", () => {
    const lean: HelpTopic = { ...full, catalog: [], read: undefined, act: undefined }
    expect(renderTopic(lean)).toBe(
      [
        "**Beispiel**",
        "- *Was:* Was es misst.",
        "- *Vorsicht:* Wo man sich täuscht.",
        "- *Mindestzahl:* Ab 1 Schuss.",
        "- *Formel:* `x = y`",
      ].join("\n")
    )
  })
})

describe("renderGuideMarkdown", () => {
  const guide = renderGuideMarkdown()

  it("Abschnitte in der Reihenfolge der Oberfläche", () => {
    const headings = guide.split("\n").filter((line) => line.startsWith("## "))
    expect(headings).toEqual([
      "## So liest du die Zahlen",
      "## Auf dem Bildschirm",
      "## Ergebnis",
      "## Präzision",
      "## Lage",
      "## Zeit und Verlauf",
      "## Datenlage",
      "## Über viele Scheiben",
      "## Vergleichen",
      "## Glossar",
      "## Typische Fehlschlüsse",
    ])
  })

  it("die Erklärungen zur Oberfläche stehen im Leitfaden, etwa das Trefferbild", () => {
    expect(guide).toContain("**Trefferbild**\n- *Was:* Jeder Treffer in Kalibergröße")
    expect(guide).toContain("**Beobachtungen in Worten**")
  })

  it("keine Zeile länger als 100 Zeichen", () => {
    for (const line of guide.split("\n")) expect(line.length, line).toBeLessThanOrEqual(100)
  })

  it("keine umbrochene Zeile beginnt wie ein Listenpunkt oder eine Überschrift", () => {
    // eingerückt hinter einem Listenpunkt würde „- …“, „1. …“ oder „# …“ zu einer neuen Liste
    const continued = guide.split("\n").filter((line) => /^\s+\S/.test(line))
    expect(continued.length).toBeGreaterThan(0)
    for (const line of continued)
      expect(line.trimStart(), line).not.toMatch(/^([-*+]\s|\d+[.)]\s|#)/)
  })

  it("gleiche Daten, gleicher Text", () => {
    expect(renderGuideMarkdown()).toBe(guide)
  })
})

describe("Abschnitt zwischen den Markern", () => {
  const note = [
    "---",
    "id: x",
    "---",
    "",
    "Vorspann.",
    "",
    GUIDE_START,
    "",
    "alt",
    "",
    GUIDE_END,
    "",
    "Nachsatz.",
  ].join("\n")

  it("liest den Abschnitt ohne die Leerzeilen an den Markern", () => {
    expect(guideSection(note)).toBe("alt")
  })

  it("ersetzt nur den Abschnitt; Vorspann, Marker und Nachsatz bleiben", () => {
    const next = replaceGuideSection(note, "## Neu\n\nText.")
    expect(next).toBe(note.replace("alt", "## Neu\n\nText."))
    expect(guideSection(next)).toBe("## Neu\n\nText.")
    // zweimal geschrieben ist dasselbe wie einmal
    expect(replaceGuideSection(next, "## Neu\n\nText.")).toBe(next)
  })

  it("ohne beide Marker, mit vertauschten oder doppelten Markern gibt es keinen Abschnitt", () => {
    const broken = [
      "Kein Marker.",
      `${GUIDE_START}\nnur Anfang`,
      `nur Ende\n${GUIDE_END}`,
      `${GUIDE_END}\nvertauscht\n${GUIDE_START}`,
      `${GUIDE_START}\na\n${GUIDE_END}\n${GUIDE_START}\nb\n${GUIDE_END}`,
    ]
    for (const text of broken) {
      expect(guideSection(text), text).toBeNull()
      expect(() => replaceGuideSection(text, "neu"), text).toThrow(/Marker/)
    }
  })
})
