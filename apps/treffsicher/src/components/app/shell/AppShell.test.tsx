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

const render = (
  isAdmin: boolean,
  pathname = "/sessions",
  search = "",
  moved: { spiegelUrl: string | null } | null = null
) => {
  nav.pathname = pathname
  nav.search = search
  return renderToStaticMarkup(h(AppShell, { isAdmin, moved, children: h("p", null, "Inhalt") }))
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

  describe("Konto nach Spiegel umgezogen", () => {
    const SPIEGEL = { spiegelUrl: "http://localhost:3002" }

    it("die Aktion führt als „Zu Spiegel“ zu Spiegel, in jeder Leiste", () => {
      const html = render(false, "/sessions", "", SPIEGEL)
      const links = [...html.matchAll(/<a [^>]*data-area="new"[^>]*>/g)].map((m) => m[0])
      expect(links).toHaveLength(3)
      for (const link of links) expect(link).toContain('href="http://localhost:3002"')
      expect(html).not.toContain('href="/sessions/new"')
      // in der unteren und der schmalen Leiste als Name des Symbols, in der Seitenleiste als Text
      expect(html.match(/data-area="new" aria-label="Zu Spiegel"/g)).toHaveLength(2)
      expect(html).toContain("Zu Spiegel</a>")
    })

    it("nicht umgezogen bleibt die Aktion Neue Einheit", () => {
      expect(render(false)).toMatch(/<a href="\/sessions\/new" data-area="new"/)
    })

    it("ohne Adresse keine Aktion, die Leiste hat vier Einträge", () => {
      const html = render(false, "/sessions", "", { spiegelUrl: null })
      expect(html).not.toContain('data-area="new"')
      expect(keysIn(html, "data-app-bar")).toEqual(["start", "sessions", "statistics", "profile"])
    })

    it("/sessions/new gehört zum Tagebuch, die Aktion ist nie die gezeigte Seite", () => {
      const html = render(false, "/sessions/new", "", SPIEGEL)
      expect(html).toMatch(/data-area="sessions" aria-current="page"/)
      expect(html).not.toMatch(/data-area="new" aria-current="page"/)
    })
  })
})
