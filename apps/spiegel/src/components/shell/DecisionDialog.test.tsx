import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { consentConfirm, ownRejectionRemove } from "@/lib/admin/consequences"

import { DecisionBody } from "./DecisionDialog"

const render = (decision: Parameters<typeof DecisionBody>[0]["decision"]) =>
  renderToStaticMarkup(createElement(DecisionBody, { decision }))

describe("Inhalt eines Entscheids", () => {
  it("prüfen, passiert, nicht passiert, rückgängig, je mit Inhalt", () => {
    const decision = consentConfirm({ who: "Max Muster", sportpassId: "12345678" })
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
    const html = render({ ...ownRejectionRemove(), notHappening: [] })
    expect(html).not.toContain("data-decision-check")
    expect(html).not.toContain("Was nicht passiert")
    expect(html).toContain("Was dann passiert")
  })
})
