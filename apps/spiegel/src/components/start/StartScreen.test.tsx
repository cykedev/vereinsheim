import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}))
vi.mock("@/lib/scoring-actions", () => ({ setFamilyScoring: async () => ({ success: true }) }))

const { StartScreen, waitingText } = await import("./StartScreen")

const render = (waiting: number) =>
  renderToStaticMarkup(
    createElement(StartScreen, {
      model: { day: null, blocks: [], form: null },
      marks: {},
      families: [],
      context: { timeZone: "Europe/Berlin", nowMs: Date.UTC(2026, 9, 17), named: [] },
      open: [],
      waiting,
    })
  )

describe("Start: Scheiben, deren Disziplin wartet", () => {
  it("kein Hinweis ohne wartende, Einzahl und Mehrzahl", () => {
    expect(render(0)).not.toContain("data-waiting-discipline")
    expect(render(1)).toContain(
      "Eine Scheibe wartet darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheint sie hier von selbst."
    )
    expect(render(3)).toContain(
      "3 Scheiben warten darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheinen sie hier von selbst."
    )
    expect(waitingText(0)).toBeNull()
  })
})
