import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DecisionBody, type Decision } from "./decision-dialog"

const confirm: Decision = {
  title: "Sportpassnummer bestätigen?",
  about: "Max Muster hat im Profil die Sportpassnummer 12345678 eingetragen.",
  check: "Gehört die Nummer zu Max Muster?",
  happens: ["Spiegel holt die Scheiben dieser Nummer.", "Max Muster sieht sie unter „Offen“."],
  notHappening: ["Andere sehen die Scheiben nicht."],
  undo: "Im Admin unter „Konten“ lässt sich die Bestätigung zurücknehmen.",
  confirmLabel: "Bestätigen",
  destructive: false,
}

const remove: Decision = {
  title: "Abgelehnte Nummer entfernen?",
  about: "Ein Admin hat diese Sportpassnummer abgelehnt.",
  happens: ["Die Zeile verschwindet."],
  notHappening: [],
  undo: "Nicht nötig.",
  confirmLabel: "Entfernen",
  destructive: false,
}

const render = (decision: Parameters<typeof DecisionBody>[0]["decision"]) =>
  renderToStaticMarkup(createElement(DecisionBody, { decision }))

describe("Inhalt eines Entscheids", () => {
  it("prüfen, passiert, nicht passiert, rückgängig, je mit Inhalt", () => {
    const decision = confirm
    const html = render(decision)
    expect(html).toContain("Vorher prüfen")
    expect(html).toContain(decision.check!)
    expect(html).toContain("Was dann passiert")
    for (const line of [...decision.happens, ...decision.notHappening]) expect(html).toContain(line)
    expect(html).toContain("Was nicht passiert")
    expect(html).toContain("Rückgängig")
    expect(html).toContain(decision.undo)
  })

  it("ohne Prüfung kein Kasten; ein leerer Abschnitt fehlt", () => {
    const html = render(remove)
    expect(html).not.toContain("data-decision-check")
    expect(html).not.toContain("Was nicht passiert")
    expect(html).toContain("Was dann passiert")
  })
})
