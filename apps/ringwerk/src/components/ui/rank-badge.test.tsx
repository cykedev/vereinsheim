import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { RankBadge } from "./rank-badge"

const render = (rank: number, podium?: boolean) =>
  renderToStaticMarkup(h(RankBadge, { rank, podium }))

describe("RankBadge", () => {
  it("Platz in der Schrift der Marke, Podium in Gold, Silber und Bronze", () => {
    expect(render(1)).toMatch(/font-display/)
    expect(render(1)).toContain("text-rank-1")
    expect(render(2)).toContain("text-rank-2")
    expect(render(3)).toContain("text-rank-3")
  })

  it("ab Platz 4 und ohne Ergebnis neutral", () => {
    expect(render(4)).toContain("text-muted-foreground")
    expect(render(1, false)).not.toContain("text-rank-1")
  })
})
