import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { areaLinks } from "../nav/areas"
import { AppFrame, type AppFrameProps } from "./AppFrame"

const render = (patch: Partial<AppFrameProps> = {}) =>
  renderToStaticMarkup(
    h(
      AppFrame,
      {
        current: "cards",
        links: areaLinks({ cards: null, progress: null }, "lp-freihand"),
        openCount: 2,
        isAdmin: true,
        ...patch,
      },
      h("div", { "data-page": true }, "Seite")
    )
  )
/** die Bereiche einer Leiste in ihrer Reihenfolge */
const areasIn = (html: string, marker: string) => {
  const start = html.indexOf(marker)
  const end = html.indexOf("</nav>", start)
  return [...html.slice(start, end).matchAll(/data-area="([a-z]+)"/g)].map((m) => m[1])
}

describe("Rahmen der App", () => {
  const html = render()

  it("Seitenleiste ab 1024 px: Start, Scheiben, Fortschritt mit Vergleichen, Scheibe holen, Profil, Admin zuletzt", () => {
    expect(areasIn(html, "data-app-sidebar")).toEqual([
      "start",
      "cards",
      "progress",
      "compare",
      "scan",
      "profile",
      "admin",
    ])
    expect(html).toMatch(
      /<div data-app-sidebar="true" class="[^"]*hidden[^"]*lg:flex[^"]*"><nav aria-label="Bereiche"/
    )
    expect(html).toMatch(/data-app-sidebar[\s\S]*?>Spiegel</)
  })

  it("untere Leiste und schmale Leiste: fünf Bereiche, Scheibe holen in der Mitte, kein Admin", () => {
    expect(areasIn(html, "data-app-bar")).toEqual(["start", "cards", "scan", "progress", "profile"])
    expect(areasIn(html, "data-app-rail")).toEqual([
      "start",
      "cards",
      "scan",
      "progress",
      "profile",
    ])
    expect(html).toMatch(/<nav aria-label="Bereiche" data-app-bar="true" class="[^"]*lg:hidden/)
    expect(html).toMatch(
      /data-app-rail="true" class="[^"]*max-lg:\[@media\(max-height:499px\)\]:flex/
    )
    // Scheibe holen als runder Knopf, der Name für Screenreader; fünf Felder
    expect(html).toMatch(
      /<a href="\/scan"[^>]*aria-label="Scheibe holen"[^>]*class="[^"]*rounded-full bg-primary/
    )
    expect(html).toContain("grid-cols-5")
    // in der Seitenleiste als Pille mit Text
    const sidebar = html.slice(
      html.indexOf("data-app-sidebar"),
      html.indexOf("</nav>", html.indexOf("data-app-sidebar"))
    )
    expect(sidebar).toMatch(/<a href="\/scan"[^>]*>[\s\S]*?Scheibe holen[\s\S]*?<\/a>/)
  })

  it("der Inhalt ist <main> und steht vor der unteren Leiste (Fokus-Reihenfolge)", () => {
    expect(html.indexOf("<main")).toBeGreaterThan(-1)
    expect(html.indexOf("<main")).toBeLessThan(html.indexOf("data-app-bar"))
  })

  it("Querformat: die schmale Leiste und der Inhalt halten den sicheren Rand frei", () => {
    expect(html).toMatch(/data-app-rail="true" class="[^"]*pl-\[env\(safe-area-inset-left\)\]/)
    expect(html).toMatch(/data-app-rail="true" class="[^"]*w-\(--app-rail\)/)
    expect(html).toContain("max-lg:[@media(max-height:499px)]:pl-(--app-rail)")
  })

  it("keine Schrift unter text-xs (conventions §3)", () => {
    expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })

  it("Vergleichen aktiv: in der Seitenleiste der Untereintrag, auf dem Telefon Fortschritt", () => {
    const page = render({ current: "compare" })
    const marked = (marker: string) => {
      const start = page.indexOf(marker)
      const part = page.slice(start, page.indexOf("</nav>", start))
      return [...part.matchAll(/<a [^>]*>/g)]
        .filter((m) => m[0].includes('aria-current="page"'))
        .map((m) => /data-area="([a-z]+)"/.exec(m[0])?.[1])
    }
    expect(marked("data-app-sidebar")).toEqual(["compare"])
    expect(marked("data-app-bar")).toEqual(["progress"])
    expect(marked("data-app-rail")).toEqual(["progress"])
  })

  it("Admin aktiv: in der Seitenleiste Admin, auf dem Telefon Profil", () => {
    const admin = render({ current: "admin" })
    const marked = (marker: string) => {
      const start = admin.indexOf(marker)
      const part = admin.slice(start, admin.indexOf("</nav>", start))
      return [...part.matchAll(/<a [^>]*>/g)]
        .filter((m) => m[0].includes('aria-current="page"'))
        .map((m) => /data-area="([a-z]+)"/.exec(m[0])?.[1])
    }
    expect(marked("data-app-sidebar")).toEqual(["admin"])
    expect(marked("data-app-bar")).toEqual(["profile"])
    expect(marked("data-app-rail")).toEqual(["profile"])
  })

  it("unten in der Seitenleiste ein Platz für Einstellungen, nur dort", () => {
    const footer = h("div", { "data-footer": true }, "DARSTELLUNG")
    const withFooter = render({ sidebarFooter: footer })
    // nach Admin, außerhalb der Navigation (eine Einstellung ist kein Weg), noch in der Seitenleiste
    expect(withFooter).toMatch(
      /<div data-app-sidebar="true"[^>]*><nav aria-label="Bereiche"[^>]*>(?:(?!<\/nav>)[\s\S])*data-area="admin"(?:(?!<\/nav>)[\s\S])*<\/nav><div data-sidebar-footer="true" class="[^"]*mt-auto[^"]*"><div data-footer="true">DARSTELLUNG/
    )
    expect(withFooter.match(/DARSTELLUNG/g)).toHaveLength(1)
    expect(html).not.toContain("data-sidebar-footer")
    // ohne Admin steht der Platz nach Profil
    expect(render({ isAdmin: false, sidebarFooter: footer })).toMatch(
      /data-area="profile"(?:(?!<\/nav>)[\s\S])*<\/nav><div data-sidebar-footer="true"/
    )
  })

  it("ohne Admin-Recht kein Admin", () => {
    expect(render({ isAdmin: false })).not.toContain('data-area="admin"')
  })

  it("der aktive Bereich, der Zähler im Namen, die Adressen aus den Links", () => {
    expect(
      html.match(
        /data-area="cards"[^>]*aria-current="page"|aria-current="page"[^>]*data-area="cards"/g
      )
    ).toHaveLength(3)
    expect(html.match(/aria-current="page"/g)).toHaveLength(3)
    expect(html.match(/aria-label="Start, 2 offen"/g)).toHaveLength(3)
    expect(html.match(/data-badge="true"[^>]*>2</g)).toHaveLength(3)
    const quiet = render({ openCount: 0 })
    expect(quiet).not.toContain("offen")
    expect(quiet).not.toContain("data-badge")
    expect(html).toContain('href="/cards?family=lp-freihand"')
    expect(html).toContain('href="/progress?family=lp-freihand"')
  })

  it("Platz für die Leiste aus --app-bar (design2.css), die Seite darin mit Abstand; nur Tokens", () => {
    expect(html).toMatch(/<div data-app-frame="true">/)
    expect(html).not.toContain("[--app-bar:")
    expect(html).toMatch(
      /<main data-app-content="true" class="[^"]*lg:pl-56[^"]*pb-\[calc\(var\(--app-bar\)\+env\(safe-area-inset-bottom\)\)\][^"]*"><div data-page="true">Seite<\/div><\/main>/
    )
    expect(html).not.toMatch(/\b(text|bg|border)-(red|green|blue|emerald|amber|slate|gray|zinc)-\d/)
    expect(html).not.toContain("dark:")
  })
})
