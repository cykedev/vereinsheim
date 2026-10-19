import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ pathname: "/competitions" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))

const { AppShell } = await import("./AppShell")

const render = (role: string, pathname = "/competitions") => {
  nav.pathname = pathname
  return renderToStaticMarkup(h(AppShell, { role, children: h("p", null, "Inhalt") }))
}

/** die Einträge einer Leiste in ihrer Reihenfolge */
const keysIn = (html: string, marker: string) => {
  const begin = html.indexOf(marker)
  const end = html.indexOf("</nav>", begin)
  return [...html.slice(begin, end).matchAll(/data-area="([a-z]+)"/g)].map((m) => m[1])
}

describe("AppShell", () => {
  it("Seitenleiste je Rolle; Admin nur für Admins, Teilnehmer und Disziplinen nicht für Mitglieder", () => {
    expect(keysIn(render("ADMIN"), "data-app-sidebar")).toEqual([
      "start",
      "competitions",
      "participants",
      "disciplines",
      "profile",
      "admin",
    ])
    expect(keysIn(render("MANAGER"), "data-app-sidebar")).toEqual([
      "start",
      "competitions",
      "participants",
      "disciplines",
      "profile",
    ])
    expect(keysIn(render("USER"), "data-app-sidebar")).toEqual(["start", "competitions", "profile"])
  })

  it("untere Leiste ohne Mitte", () => {
    expect(keysIn(render("ADMIN"), "data-app-bar")).toEqual([
      "start",
      "competitions",
      "participants",
      "profile",
    ])
    expect(keysIn(render("USER"), "data-app-bar")).toEqual(["start", "competitions", "profile"])
  })

  it("Admin führt zu den Konten", () => {
    expect(render("ADMIN")).toMatch(/<a href="\/admin\/users" data-area="admin"/)
  })

  it("aktiver Eintrag aus der Adresse; am Telefon steht Disziplinen unter Profil", () => {
    const html = render("ADMIN", "/disciplines/1/edit")
    expect(html).toMatch(/data-area="disciplines" aria-current="page"/)
    const bar = html.slice(html.indexOf("data-app-bar"))
    expect(bar).toMatch(/data-area="profile" aria-current="page"/)
  })

  it("Start nur auf /", () => {
    expect(render("USER", "/")).toMatch(/data-area="start" aria-current="page"/)
    expect(render("USER", "/competitions/x")).not.toMatch(/data-area="start" aria-current="page"/)
  })
})
