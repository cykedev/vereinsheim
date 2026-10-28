import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
}))
vi.mock("@/lib/fetch-card/actions", () => ({
  fetchCardByLink: async () => ({ success: true }),
  fetchCardByUpload: async () => ({ success: true }),
  fetchCardById: async () => ({ success: true }),
  stopCardFetch: async () => ({ success: true }),
}))

const { ScanScreen, sheetPreset } = await import("./ScanScreen")

const render = (legacy: Parameters<typeof ScanScreen>[0]["legacy"] = []) =>
  renderToStaticMarkup(
    createElement(ScanScreen, {
      options: [{ id: 1, name: "LP 40", family: "Luftpistole" }],
      preset: { disciplineId: 1, kind: "training" },
      legacy,
      today: "2026-10-27",
      timeZone: "Europe/Berlin",
    })
  )

describe("Seite „Scheibe holen“ (Markup)", () => {
  it("Titel, Satz und fünf Wege in der Folge Kamera, Link, PDF, ID, von Hand", () => {
    const html = render()
    expect(html).toMatch(/<h1[^>]*>Scheibe holen<\/h1>/)
    expect(html).toContain("Liegt die Scheibe schon in Spiegel, öffnet Spiegel sie.")
    const ways = [...html.matchAll(/data-fetch-way="([a-z]+)"/g)].map((m) => m[1])
    expect(ways).toEqual(["camera", "link", "upload", "id", "hand"])
    for (const title of [
      "QR-Code scannen",
      "Link einfügen",
      "PDF hochladen",
      "ID eintippen",
      "Von Hand eintragen",
    ])
      expect(html).toContain(`>${title}</h2>`)
    expect(html).toContain(
      "Für eine Scheibe ohne Ausdruck, etwa von einer anderen Anlage oder vom Papier."
    )
    expect(html).toContain(">Eintragen</button>")
  })

  it("Felder mit Namen: Link, PDF, ID und Tag", () => {
    const html = render()
    expect(html).toMatch(/<label[^>]*for="fetch-link"[^>]*>Link aus dem QR-Code<\/label>/)
    expect(html).toMatch(
      /<input[^>]*id="fetch-upload"[^>]*type="file"[^>]*accept="application\/pdf"/
    )
    expect(html).toMatch(/<label[^>]*for="fetch-upload"[^>]*>PDF wählen<\/label>/)
    expect(html).toMatch(/<label[^>]*for="fetch-id"[^>]*>ID vom Ausdruck<\/label>/)
    expect(html).toMatch(/<label[^>]*for="fetch-day"[^>]*>Tag der Scheibe<\/label>/)
    expect(html).toMatch(/<input[^>]*id="fetch-day"[^>]*max="2026-10-27"[^>]*value="2026-10-27"/)
  })

  it("„Holen“ ist ohne Eingabe nicht gesperrt (der Grund kommt beim Tippen am Feld)", () => {
    const html = render()
    for (const way of ["link", "id"]) {
      const card = html.slice(html.indexOf(`data-fetch-way="${way}"`))
      expect(card).toMatch(/<button(?![^>]*disabled="")[^>]*type="submit">Holen<\/button>/)
    }
  })

  it("ältere Aufträge nur mit Einträgen", () => {
    expect(render()).not.toContain("data-legacy-requests")
    const html = render([{ id: 3, hex: "ff914420", day: "2026-10-21" }])
    expect(html).toContain("data-legacy-requests")
    expect(html.replace(/<[^>]+>/g, "")).toContain(
      "ff914420 · Mi 21.10.2026 · wartet auf die Anlage"
    )
    expect(html).toContain("Nicht mehr holen")
    // ganz unten, nach den Wegen
    expect(html.indexOf("data-legacy-requests")).toBeGreaterThan(
      html.indexOf('data-fetch-way="id"')
    )
  })
})

describe("Vorbelegung des Blatts „Neue Scheibe“", () => {
  it("die Disziplin aus dem Kopf des Ausdrucks vor der der letzten Scheibe", () => {
    const last = { disciplineId: 1, kind: "competition" } as const
    expect(sheetPreset(last, 7)).toEqual({ disciplineId: 7, kind: "competition" })
    expect(sheetPreset(last, null)).toEqual(last)
    expect(sheetPreset({ disciplineId: null, kind: "training" }, null)).toEqual({
      disciplineId: null,
      kind: "training",
    })
  })
})
