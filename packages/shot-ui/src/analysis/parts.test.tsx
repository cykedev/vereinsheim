import { VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MpiMark } from "../target/MpiMark"
import { AnalysisCard, IntervalBar, KeyValues, Note, scaleStep, Verdict } from "./parts"

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element)

describe("AnalysisCard", () => {
  it("Titel, Katalog-IDs mit „ · “ und Kurzsatz aus dem Thema, darunter „Was heißt das?“", () => {
    const topic = helpTopic("masse-der-gruppe")!
    const html = render(
      createElement(AnalysisCard, { help: "masse-der-gruppe", explain: false, children: "Inhalt" })
    )
    expect(html).toMatch(
      new RegExp(
        `<h3[^>]*title="${topic.short}"[^>]*><span>${topic.title}</span><span[^>]*>${topic.catalog.join(" · ")}</span></h3>`
      )
    )
    expect(html).toContain("Inhalt")
    expect(html).toMatch(/<details data-help="masse-der-gruppe"(?! open)/)
    expect(
      render(
        createElement(AnalysisCard, { help: "masse-der-gruppe", explain: true, children: "x" })
      )
    ).toMatch(/<details data-help="masse-der-gruppe" open=""/)
  })

  it("Oberflächen-Hilfe: Titel aus VIEW_HELP, eigene IDs, kein Kurzsatz", () => {
    const view = VIEW_HELP.find((v) => v.id === "beobachtungen")!
    const html = render(
      createElement(AnalysisCard, {
        help: "beobachtungen",
        ids: "aus den Zahlen",
        explain: false,
        children: "x",
      })
    )
    expect(html).toMatch(
      new RegExp(`<h3[^>]*><span>${view.title}</span><span[^>]*>aus den Zahlen</span>`)
    )
    expect(html).not.toMatch(/<h3[^>]*title=/)
  })

  it("ohne Hilfe nur Titel und Inhalt; breite Karten sind markiert", () => {
    const html = render(
      createElement(AnalysisCard, {
        title: "So liest du die Analyse",
        wide: true,
        explain: true,
        children: "x",
      })
    )
    expect(html).toContain("So liest du die Analyse")
    expect(html).not.toContain("<details")
    expect(html).toContain('data-wide="true"')
  })
})

describe("Werte, Urteil, Hinweis", () => {
  it("Werteliste ohne leere Zeilen", () => {
    const html = render(
      createElement(KeyValues, {
        rows: [["Streukreis", "73,6 mm"], null, ["R50", "12,29 mm"]],
      })
    )
    expect([...html.matchAll(/<dt[^>]*>([^<]+)<\/dt>/g)].map((m) => m[1])).toEqual([
      "Streukreis",
      "R50",
    ])
  })

  it("Urteil in den Farben der Bedeutung, Hinweis zurückgenommen", () => {
    expect(render(createElement(Verdict, { tone: "ok", children: "belastbar" }))).toContain(
      "text-success"
    )
    expect(render(createElement(Verdict, { tone: "warn", children: "echt" }))).toContain(
      "text-warning"
    )
    expect(render(createElement(Verdict, { tone: "none", children: "unklar" }))).toContain(
      "text-muted-foreground"
    )
    expect(render(createElement(Note, { children: "ab 3 Schuss" }))).toMatch(
      /<p[^>]*class="[^"]*text-muted-foreground[^"]*"[^>]*>ab 3 Schuss<\/p>/
    )
  })
})

describe("Intervallbalken und Maßstab", () => {
  it("Bereich und Punkt an ihrer Stelle auf der Skala", () => {
    const html = render(
      createElement(IntervalBar, {
        value: 0.5,
        low: 0.25,
        high: 0.75,
        min: 0,
        max: 1,
        label: "Quote",
      })
    )
    expect(html).toContain('aria-label="Quote"')
    expect(html).toMatch(/data-range="true"[^>]*style="left:25%;width:50%"/)
    expect(html).toMatch(/data-point="true"[^>]*style="left:50%"/)
  })

  it("Maßstab: der erste runde Wert ab einem Viertel der Spanne", () => {
    expect(scaleStep(20)).toBe(5)
    expect(scaleStep(0.3)).toBe(0.1)
    expect(scaleStep(3)).toBe(1)
    expect(scaleStep(1000)).toBe(50)
  })
})

describe("MpiMark", () => {
  it("weiße Scheibe mit zwei schwarzen Vierteln aus den Tokens, Attribute vor der Lage", () => {
    const html = render(
      createElement(
        "svg",
        null,
        createElement(MpiMark, { x: 1, y: 2, radius: 5, ...({ "data-overlay": "mpi" } as object) })
      )
    )
    expect(html).toMatch(/<g data-overlay="mpi" transform="translate\(1 2\) scale\(5\)">/)
    expect(html).toContain('fill="var(--mpi-light)"')
    expect(html).toContain('fill="var(--mpi-dark)"')
    expect(html).toContain("<title>Schwerpunkt</title>")
  })
})
