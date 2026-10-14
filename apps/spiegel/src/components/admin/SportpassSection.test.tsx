import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { ConsentRow, OpenConsentRow } from "@/lib/consent/queries"
import type { ConsentStatus } from "@/lib/consent/status"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/consent/actions", () => ({
  confirmConsent: async () => ({ success: true }),
  rejectConsent: async () => ({ success: true }),
  removeConsent: async () => ({ success: true }),
}))

const { SportpassSection } = await import("./SportpassSection")
const { OpenConsents } = await import("./OpenConsents")

const row = (id: number, status: ConsentStatus): ConsentRow => ({
  id,
  sportpassId: String(1000 + id),
  siteName: "Schützenhaus",
  status,
  statusText: status,
  consentedAt: "14.10.2026, 20:00",
  consentVersion: "v1",
})
const item = (html: string, status: ConsentStatus) =>
  html.match(new RegExp(`data-consent="${status}".*?</li>`))![0]

describe("Zustimmungen am Konto (Admin)", () => {
  it("bestätigen und ablehnen nur offene; entfernen jede", () => {
    const html = renderToStaticMarkup(
      createElement(SportpassSection, {
        consents: [row(1, "requested"), row(2, "returned"), row(3, "active"), row(4, "rejected")],
      })
    )
    for (const status of ["requested", "returned"] as const) {
      expect(item(html, status)).toContain(">Bestätigen<")
      expect(item(html, status)).toContain(">Ablehnen<")
    }
    for (const status of ["active", "rejected"] as const) {
      expect(item(html, status)).not.toContain("Bestätigen")
      expect(item(html, status)).not.toContain("Ablehnen")
    }
    expect(html.match(/>Entfernen</g)).toHaveLength(4)
    expect(item(html, "requested")).toContain("Hinweis v1")
  })

  it("kein Formular zum Eintragen; ohne Zustimmung ein Satz", () => {
    const html = renderToStaticMarkup(createElement(SportpassSection, { consents: [] }))
    expect(html).not.toContain("<form")
    expect(html).toContain("Keine Zustimmung an diesem Konto.")
  })
})

describe("Offene Zustimmungen (Admin)", () => {
  const open = (id: number, status: ConsentStatus): OpenConsentRow => ({
    id,
    userId: `u${id}`,
    userLabel: `Schütze ${id}`,
    sportpassId: String(2000 + id),
    status,
    consentedAt: "14.10.2026, 20:00",
  })

  it("Zahl, Link aufs Konto, zurückgegebene benannt", () => {
    const html = renderToStaticMarkup(
      createElement(OpenConsents, { consents: [open(1, "returned"), open(2, "requested")] })
    )
    expect(html).toContain("Offene Zustimmungen (2)")
    expect(html).toContain('href="/admin/users/u1"')
    expect(html).toContain("zurück beim Admin")
    expect(html).toContain("2002")
  })

  it("ohne offene der Satz", () => {
    const html = renderToStaticMarkup(createElement(OpenConsents, { consents: [] }))
    expect(html).toContain("Offene Zustimmungen (0)")
    expect(html).toContain("Keine offenen Zustimmungen.")
  })
})
