import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))
vi.mock("next-auth/react", () => ({ signOut: async () => {} }))

const { ProfileScreen } = await import("./ProfileScreen")

const render = (isAdmin: boolean) =>
  renderToStaticMarkup(
    createElement(ProfileScreen, {
      name: "Schütze",
      email: "schuetze@example.com",
      isAdmin,
      sportpass: [],
      requests: [],
      today: "2026-10-26",
      timeZone: "Europe/Berlin",
      trashCount: 0,
    })
  )

/** die Links im Abschnitt „Admin“ */
const adminLinks = (html: string) => {
  const nav = html.match(/<nav aria-label="Admin"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? ""
  return [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
}

describe("Profil (Markup)", () => {
  it("ein Admin sieht oben alle Bereiche des Admins, nur am Telefon", () => {
    const html = render(true)
    expect(adminLinks(html)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/disciplines",
      "/admin/lists",
      "/admin/site",
    ])
    expect(html).toMatch(/<nav aria-label="Admin"[^>]*class="[^"]*lg:hidden/)
    // vor der Zustimmung per Sportpass, nicht unten bei Abmelden
    expect(html.indexOf('aria-label="Admin"')).toBeLessThan(html.indexOf("Sportpass"))
  })

  it("ein Schütze sieht keinen Abschnitt „Admin“", () => {
    const html = render(false)
    expect(html).not.toContain('aria-label="Admin"')
    expect(html).not.toContain('href="/admin')
  })
})
