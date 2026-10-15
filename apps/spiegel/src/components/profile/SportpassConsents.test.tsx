import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { ConsentRow } from "@/lib/consent/queries"
import type { ConsentStatus } from "@/lib/consent/status"
import { CONSENT_TEXTS, CURRENT_CONSENT_VERSION } from "@/lib/consent/texts"

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
  historyLoaded: false,
})
const render = (consents: ConsentRow[]) =>
  renderToStaticMarkup(
    createElement(SportpassConsents, { consents, version: CURRENT_CONSENT_VERSION })
  )

describe("Sportpass im Profil", () => {
  it("je Zustimmung der Status in Worten und die passende Aktion", () => {
    const html = render([
      row(1, "requested", "wartet auf den Admin"),
      row(2, "rejected", "abgelehnt"),
    ])
    expect(html).toContain("wartet auf den Admin")
    expect(html).toContain("abgelehnt")
    expect(html).not.toContain("Schützenhaus ·")
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

  it("das Formular zeigt den aktuellen Hinweistext und den Haken, solange keine Nummer da ist", () => {
    const html = render([])
    expect(html).toContain("data-consent-form")
    expect(html).toContain(CONSENT_TEXTS[CURRENT_CONSENT_VERSION]!.title)
    for (const paragraph of CONSENT_TEXTS[CURRENT_CONSENT_VERSION]!.paragraphs)
      expect(html).toContain(paragraph.slice(0, 40))
    expect(html).toMatch(/<input type="checkbox"[^>]*name="agree"/)
    // die Version des gezeigten Texts geht mit (Review)
    expect(html).toContain(`<input type="hidden" name="version" value="${CURRENT_CONSENT_VERSION}"`)
    expect(html).not.toContain("data-one-number")
    // eine Nummer je Konto (User, 15. Oktober 2026): mit einer, auch einer abgelehnten, kein Formular, dafür der Weg
    for (const status of ["active", "requested", "rejected", "returned"] as const) {
      const one = render([row(1, status, "s")])
      expect(one).not.toContain("data-consent-form")
      expect(one).toContain(
        "Ein Konto hat eine Sportpassnummer. Für einen neuen Ausweis widerrufe die alte Nummer. Dann trag die neue ein. Deine Scheiben bleiben."
      )
    }
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
