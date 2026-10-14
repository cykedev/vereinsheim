import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { ConsentRow } from "@/lib/consent/queries"
import type { ConsentStatus } from "@/lib/consent/status"
import { CONSENT_TEXTS } from "@/lib/consent/texts"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/consent/actions", () => ({
  requestSportpass: async () => ({ success: true }),
  revokeSportpass: async () => ({ success: true }),
}))

const { SportpassConsents } = await import("./SportpassConsents")

const row = (id: number, status: ConsentStatus, statusText: string): ConsentRow => ({
  id,
  sportpassId: String(1000 + id),
  siteName: "Schützenhaus",
  status,
  statusText,
  consentedAt: "14.10.2026, 20:00",
  consentVersion: "v1",
  history: null,
})
const render = (consents: ConsentRow[]) =>
  renderToStaticMarkup(createElement(SportpassConsents, { consents, version: "v1" }))

describe("Sportpass im Profil", () => {
  it("je Zustimmung der Status in Worten und die passende Aktion", () => {
    const html = render([
      row(1, "requested", "wartet auf den Admin"),
      row(2, "rejected", "abgelehnt"),
    ])
    expect(html).toContain("Schützenhaus · wartet auf den Admin")
    expect(html).toContain("Schützenhaus · abgelehnt")
    const item = (status: string) => html.match(new RegExp(`data-consent="${status}".*?</li>`))![0]
    expect(item("requested")).toContain(">Widerrufen<")
    expect(item("rejected")).toContain(">Entfernen<")
    expect(item("rejected")).not.toContain("Widerrufen")
  })

  it("widerrufen lässt sich, was zählt oder zählen kann", () => {
    const html = render([
      row(1, "active", "aktiv seit 14.10.2026, 20:00"),
      row(2, "returned", "zurück beim Admin"),
    ])
    expect(html.match(/>Widerrufen</g)).toHaveLength(2)
  })

  it("das Formular zeigt den Hinweistext v1 und den Haken, bis drei SportpassIDs da sind", () => {
    const html = render([row(1, "active", "aktiv")])
    expect(html).toContain("data-consent-form")
    expect(html).toContain(CONSENT_TEXTS.v1!.title)
    for (const paragraph of CONSENT_TEXTS.v1!.paragraphs)
      expect(html).toContain(paragraph.slice(0, 40))
    expect(html).toMatch(/<input type="checkbox"[^>]*name="agree"/)
    // die Version des gezeigten Texts geht mit (Review)
    expect(html).toMatch(/<input type="hidden" name="version" value="v1"/)
    const full = render([
      row(1, "active", "aktiv"),
      row(2, "requested", "w"),
      row(3, "rejected", "a"),
    ])
    expect(full).not.toContain("data-consent-form")
  })

  it("bei aktiver Zustimmung der Stand des Nachladens (P2d)", () => {
    const html = render([
      {
        ...row(1, "active", "aktiv"),
        history: "ältere Scheiben werden nachgeladen, wenn niemand schießt",
      },
      row(2, "requested", "wartet auf den Admin"),
    ])
    expect(html).toContain("ältere Scheiben werden nachgeladen, wenn niemand schießt")
    expect(html.match(/data-consent-history/g)).toHaveLength(1)
  })
})
