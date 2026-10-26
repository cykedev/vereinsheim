import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))

const { ShareCard, buttonLabels } = await import("./ShareCard")

const ID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c"
const render = (share: { shareId: string; sharedAtMs: number } | null) =>
  renderToStaticMarkup(
    createElement(ShareCard, {
      cardId: "c1",
      when: "Di 13.10.2026 · 19:12",
      share,
      onChange: () => {},
      timeZone: "Europe/Berlin",
    })
  )

describe("Abschnitt Teilen", () => {
  it("nicht geteilt: nur der Knopf zum Teilen", () => {
    const html = render(null)
    expect(html).toContain("Scheibe teilen</button>")
    expect(html).not.toContain("data-share-link")
    expect(html).not.toContain("Teilen beenden")
  })

  it("geteilt: seit wann, der Link (auf dem Server als Pfad), Kopieren und Beenden; Senden erst im Browser", () => {
    const html = render({ shareId: ID, sharedAtMs: Date.UTC(2026, 9, 20, 22, 30) })
    // 22:30 UTC ist in Berlin schon der 21.
    expect(html).toContain("Geteilt seit 21.10.2026")
    expect(html).toMatch(new RegExp(`data-share-link[^>]*>/share/${ID}<`))
    expect(html).toContain("Link kopieren</button>")
    expect(html).toContain("Teilen beenden</button>")
    expect(html).not.toContain("Senden")
    expect(html).not.toContain("Scheibe teilen</button>")
  })
})

describe("Beschriftung der Knöpfe", () => {
  it("ohne laufende Aktion die Namen der Aktionen", () => {
    expect(buttonLabels(false, "share")).toEqual({
      share: "Scheibe teilen",
      stop: "Teilen beenden",
    })
    expect(buttonLabels(false, "stop")).toEqual({ share: "Scheibe teilen", stop: "Teilen beenden" })
  })

  it("„…“ nur an der Aktion, die läuft", () => {
    expect(buttonLabels(true, "share").share).toBe("Teilen…")
    expect(buttonLabels(true, "stop").stop).toBe("Beenden…")
  })

  it("nach dem Teilen rechnet die Seite noch neu: der Knopf zum Beenden heißt weiter „Teilen beenden“", () => {
    // Link und Knopf erscheinen zusammen; „Beenden…“ hieße, es werde beendet, obwohl gerade geteilt wurde
    expect(buttonLabels(true, "share").stop).toBe("Teilen beenden")
    // und umgekehrt nach dem Beenden
    expect(buttonLabels(true, "stop").share).toBe("Scheibe teilen")
  })
})
