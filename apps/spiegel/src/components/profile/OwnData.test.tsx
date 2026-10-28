import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { DecisionBody } from "@vereinsheim/ui/design2/decision-dialog"

import { accountDelete } from "@/lib/admin/consequences"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))
vi.mock("next-auth/react", () => ({ signOut: async () => {} }))
vi.mock("@/parts/account-actions", () => ({ deleteOwnAccount: async () => ({ success: true }) }))

const { OwnData, OwnDataPassword } = await import("./OwnData")
const { ProfileScreen } = await import("./ProfileScreen")

describe("Deine Daten (Markup)", () => {
  it("Herunterladen als Datei, Konto löschen als Knopf", () => {
    const html = renderToStaticMarkup(
      createElement(OwnData, { email: "schuetze@example.com", lastAdmin: false })
    )
    expect(html).toContain(">Deine Daten</h2>")
    expect(html).toMatch(/<a href="\/api\/account\/export" download=""[^>]*>.*Herunterladen<\/a>/)
    expect(html).toContain(
      "Alle Scheiben und das Tagebuch in einer Datei (JSON). Ausdrucke und Belege als PDF oder Foto sind nicht darin."
    )
    expect(html).toMatch(/<button type="button"[^>]*>.*Konto löschen<\/button>/)
    expect(html).toContain("Löscht dein Konto mit allen Scheiben und dem Tagebuch.")
  })

  it("die Rückfrage nennt das Konto und die Folgen, das Feld nimmt das Passwort", () => {
    const body = renderToStaticMarkup(
      createElement(DecisionBody, { decision: accountDelete({ email: "schuetze@example.com" }) })
    )
    expect(body).toContain("Lade vorher deine Daten herunter, wenn du sie behalten willst.")
    expect(body).toContain("Spiegel löscht dein Tagebuch mit allen Einträgen.")

    const field = (error: string | null) =>
      renderToStaticMarkup(
        createElement(OwnDataPassword, { password: "", onChange: () => {}, error })
      )
    expect(field(null)).toMatch(/<label[^>]*for="own-data-password"[^>]*>Dein Passwort<\/label>/)
    expect(field(null)).toMatch(/<input type="password"[^>]*autoComplete="current-password"/)
    expect(field(null)).not.toContain('aria-invalid="true"')
    const wrong = field("Das Passwort stimmt nicht.")
    expect(wrong).toContain('aria-invalid="true"')
    expect(wrong).toContain('aria-describedby="own-data-password-error"')
    expect(wrong).toMatch(
      /<p id="own-data-password-error" role="alert"[^>]*>Das Passwort stimmt nicht.<\/p>/
    )
  })

  it("steht im Profil nach der Darstellung, vor Papierkorb und Abmelden", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileScreen, {
        name: null,
        email: "schuetze@example.com",
        isAdmin: false,
        sportpass: [],
        trashCount: 0,
      })
    )
    expect(html.indexOf("Dieses Gerät")).toBeLessThan(html.indexOf("data-own-data"))
    expect(html.indexOf("data-own-data")).toBeLessThan(html.indexOf(">Abmelden<"))
  })
})
