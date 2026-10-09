import { VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { isValidElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { MpiMark } from "../target/MpiMark"
import { HelpButton } from "../help/HelpButton"
import { AnalysisCard, IntervalBar, KeyValues, Note, scaleStep, Verdict } from "./parts"

/** das erste Element eines Typs im Baum */
function findElement(node: ReactNode, type: unknown): { props: Record<string, unknown> } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type)
      if (hit) return hit
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as Record<string, unknown>
  if (node.type === type) return { props }
  return findElement(props.children as ReactNode, type)
}

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element)

describe("AnalysisCard", () => {
  it("Titel, Kurzsatz als title und „?“ im Kopf statt „Was heißt das?“ (D3), keine Katalog-IDs", () => {
    const topic = helpTopic("masse-der-gruppe")!
    const html = render(
      createElement(AnalysisCard, {
        help: "masse-der-gruppe",
        explain: false,
        onHelp: () => {},
        children: "Inhalt",
      })
    )
    expect(html).toMatch(
      new RegExp(`<h3[^>]*title="${topic.short}"[^>]*><span>${topic.title}</span>`)
    )
    // die Verweise in den Katalog („E1 · E2“) interessieren nicht (User, 9. Oktober 2026)
    expect(topic.catalog.length).toBeGreaterThan(0)
    for (const id of topic.catalog) expect(html).not.toContain(id)
    expect(html).not.toContain("font-mono")
    expect(html).toMatch(
      new RegExp(
        `<button[^>]*aria-label="Erklärung: ${topic.title}"[^>]*data-help="masse-der-gruppe"`
      )
    )
    expect(html).toContain("Inhalt")
    expect(html).not.toContain("<details")
    expect(html).not.toContain("data-short")
  })

  it("„?“ meldet die Erklärung der Karte", () => {
    const onHelp = vi.fn<(id: string) => void>()
    const tree = AnalysisCard({ help: "masse-der-gruppe", explain: false, onHelp, children: "x" })
    const button = findElement(tree, HelpButton)!
    ;(button.props.onClick as () => void)()
    expect(onHelp).toHaveBeenCalledWith("masse-der-gruppe")
  })

  it("„Erklärungen“ zeigt den Kurzsatz unter dem Titel; ohne onHelp kein „?“", () => {
    const topic = helpTopic("masse-der-gruppe")!
    const html = render(
      createElement(AnalysisCard, { help: "masse-der-gruppe", explain: true, children: "x" })
    )
    expect(html).toContain(
      `<p data-short="true" class="text-[12.5px] leading-snug text-foreground-2">${topic.short}</p>`
    )
    expect(html).not.toContain("<button")
  })

  it("Oberflächen-Hilfe: Titel aus VIEW_HELP, eigener Zusatz, kein Kurzsatz", () => {
    const view = VIEW_HELP.find((v) => v.id === "beobachtungen")!
    const html = render(
      createElement(AnalysisCard, {
        help: "beobachtungen",
        tag: "aus den Zahlen",
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
