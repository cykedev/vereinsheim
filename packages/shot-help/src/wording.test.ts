import { describe, expect, it } from "vitest"

import { GLOSSARY } from "./glossary"
import { FALLACIES, READING_GUIDE, VIEW_HELP } from "./guide"
import { helpTopic } from "./lookup"
import { HELP_TOPICS } from "./topics"

/** jeder Text der Hilfe, auch Titel und Formeln */
const allTexts = () => [
  ...HELP_TOPICS.flatMap((t) => Object.values(t).filter((v): v is string => typeof v === "string")),
  ...READING_GUIDE.flatMap((i) => [i.title, i.text]),
  ...FALLACIES.flatMap((i) => [i.title, i.text]),
  ...VIEW_HELP.flatMap((v) => Object.values(v).filter((x): x is string => typeof x === "string")),
  ...GLOSSARY.flatMap((g) => [g.term, g.text]),
]

describe("Wortwahl wie auf der Seite (U3, D9)", () => {
  it("die Streuung heißt so, der Fachbegriff steht im Titel dabei", () => {
    expect(helpTopic("praezision-sigma")?.title).toBe("Streuung σ")
  })

  it("der Vergleich zweier Zeiträume zitiert die Urteile der Seite", () => {
    const topic = helpTopic("zeitraum-vergleich")!
    const text = [topic.read, topic.caution, topic.formula].join(" ")
    expect(text).toContain("„besser“ oder „schwächer“")
    expect(text).toContain("„kein klarer Unterschied“")
    expect(text).toContain("„deutlich“")
  })

  it("kein Text sagt mehr „bedeutsam“", () => {
    for (const text of allTexts()) expect(text).not.toMatch(/bedeutsam/i)
  })

  it("der Ringverlust erklärt „Lage kostet nichts“ in den Worten der Seite (U3, D10)", () => {
    const caution = helpTopic("ringverlust-nach-ursache")?.caution ?? ""
    expect(caution).toContain("Spiegel schreibt dann „Lage kostet nichts“")
    expect(caution).toContain("wenn die Lage sicher versetzt ist")
    expect(caution).not.toMatch(/\becht/)
  })

  it("der Vergleich zitiert den Satz oben, wie er dasteht", () => {
    expect(helpTopic("zeitraum-vergleich")?.read).toContain("„ein klarer Unterschied“")
  })

  it("die Lage in Alltagsworten: „sicher versetzt“ oder „kann Zufall sein“ (U3, D11)", () => {
    const topic = helpTopic("lage-echt")!
    expect(topic.title).toBe("Ist die Lage versetzt?")
    expect(topic.read).toContain("„Sicher versetzt“")
    expect(topic.read).toContain("„Kann Zufall sein“")
    const guide = READING_GUIDE.find((i) => i.title === "„Sicher“ und „kann Zufall sein“")
    expect(guide?.text).toContain("„Passt“")
    // außerhalb der Probe-Themen (U4 entfernt sie) kein „echt“ und kein „unklar“ mehr als Urteil
    const texts = [
      ...[topic.title, topic.read, topic.act ?? ""],
      ...READING_GUIDE.flatMap((i) => [i.title, i.text]),
      ...FALLACIES.flatMap((i) => [i.title, i.text]),
      ...VIEW_HELP.flatMap((v) => [v.title, v.what, v.read ?? ""]),
    ]
    for (const text of texts) expect(text).not.toMatch(/„(echt|Echt|unklar|Unklar)/)
  })

  it("der Einstieg zitiert einen Bereich so, wie ihn die Seite zeigt", () => {
    expect(READING_GUIDE.map((i) => i.text).join(" ")).toContain(
      "„Streuung 1,12 mm, sicher zwischen 0,94 und 1,36 mm“"
    )
  })
})
