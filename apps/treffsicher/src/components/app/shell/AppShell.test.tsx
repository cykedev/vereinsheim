import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ pathname: "/sessions", search: "" }))
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))

const { AppShell, statisticsMemory } = await import("./AppShell")

const render = (isAdmin: boolean, pathname = "/sessions", search = "") => {
  nav.pathname = pathname
  nav.search = search
  return renderToStaticMarkup(h(AppShell, { isAdmin, children: h("p", null, "Inhalt") }))
}

/** die Einträge einer Leiste in ihrer Reihenfolge */
const keysIn = (html: string, marker: string) => {
  const begin = html.indexOf(marker)
  const end = html.indexOf("</nav>", begin)
  return [...html.slice(begin, end).matchAll(/data-area="([a-z]+)"/g)].map((m) => m[1])
}

describe("AppShell", () => {
  it("Admin nur für Admins", () => {
    expect(keysIn(render(true), "data-app-sidebar")).toContain("admin")
    expect(keysIn(render(false), "data-app-sidebar")).not.toContain("admin")
  })

  it("Seitenleiste in der festgelegten Reihenfolge, Neue Einheit als Pille vor dem Trenner", () => {
    expect(keysIn(render(true), "data-app-sidebar")).toEqual([
      "start",
      "sessions",
      "statistics",
      "goals",
      "routines",
      "disciplines",
      "new",
      "profile",
      "admin",
    ])
  })

  it("untere Leiste: Neue Einheit in der Mitte", () => {
    expect(keysIn(render(false), "data-app-bar")).toEqual([
      "start",
      "sessions",
      "new",
      "statistics",
      "profile",
    ])
  })

  it("„Neue Einheit“ zeigt auf /sessions/new", () => {
    expect(render(false)).toMatch(/<a href="\/sessions\/new" data-area="new"/)
  })

  it("aktiver Eintrag aus der Adresse; am Telefon steht Ziele unter Profil", () => {
    const html = render(false, "/goals/1")
    expect(html).toMatch(/data-area="goals" aria-current="page"/)
    const bar = html.slice(html.indexOf("data-app-bar"))
    expect(bar).toMatch(/data-area="profile" aria-current="page"/)
  })

  it("„Statistik“ führt zur zuletzt gesehenen Adresse der Statistik, ohne die gewählte Einheit", () => {
    expect(render(false)).toMatch(/<a href="\/statistics" data-area="statistics"/)
    const html = render(false, "/statistics", "range=6m&family=lg&pick=abc")
    expect(html).toMatch(/<a href="\/statistics\?range=6m&amp;family=lg" data-area="statistics"/)
    expect(statisticsMemory(new URLSearchParams("pick=abc"))).toBe("/statistics")
  })
})
