import { describe, expect, it } from "vitest"

import { renderGuideMarkdown, renderTopic, wrapText } from "./markdown"
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
      "## Ergebnis",
      "## Präzision",
      "## Lage",
      "## Zeit und Verlauf",
      "## Probe",
      "## Datenlage",
      "## Glossar",
      "## Typische Fehlschlüsse",
    ])
  })

  it("keine Zeile länger als 100 Zeichen", () => {
    for (const line of guide.split("\n")) expect(line.length, line).toBeLessThanOrEqual(100)
  })

  it("gleiche Daten, gleicher Text", () => {
    expect(renderGuideMarkdown()).toBe(guide)
  })
})
