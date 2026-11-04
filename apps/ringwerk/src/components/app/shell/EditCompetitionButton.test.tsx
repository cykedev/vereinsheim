import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { EditCompetitionButton } from "./CompetitionDetailHeader"

const render = (status: "ACTIVE" | "COMPLETED" | "ARCHIVED", canManage: boolean) =>
  renderToStaticMarkup(createElement(EditCompetitionButton, { id: "c1", status, canManage }))

describe("EditCompetitionButton", () => {
  it("führt die Sportleitung zum Bearbeiten", () => {
    const html = render("ACTIVE", true)
    expect(html).toContain('href="/competitions/c1/edit"')
    expect(html).toContain("Bearbeiten")
  })

  it("steht auch bei abgeschlossenen Wettbewerben", () => {
    expect(render("COMPLETED", true)).toContain('href="/competitions/c1/edit"')
  })

  it("fehlt bei archivierten Wettbewerben, wie in der Übersicht", () => {
    expect(render("ARCHIVED", true)).toBe("")
  })

  it("fehlt für Mitglieder ohne Verwaltungsrecht", () => {
    expect(render("ACTIVE", false)).toBe("")
  })
})
