import { drift, mpiConfidence, mpiPath, ringLossSplit } from "@vereinsheim/shot-core/analysis"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { isValidElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { directionWords, formatValue } from "../../format"
import { initialViewState, type Layer } from "../../view-state"
import { analysisInput } from "../input"
import { fortyCard } from "../testCard"
import { cardHtml, cardText, renderTab } from "../testPanel"
import { positionCards } from "./PositionTab"

const CARD = fortyCard()
const BASE = CARD.filter((s) => s.kind === "match")

/** Attribut `style` eines Elements mit Markierung, unabhängig von der Reihenfolge der Attribute */
const styleOf = (html: string, marker: string) =>
  html.match(new RegExp(`<[^>]*${marker}[^>]*style="([^"]*)"`))?.[1]

/** das erste Element eines Typs im Baum der Karten */
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

describe("Reiter Lage", () => {
  const html = renderTab("position")

  it("Lage echt? mit Schwerpunkt in Worten, Abstand, Hotelling-T² und Urteil des Fachkerns", () => {
    const conf = mpiConfidence(BASE)!
    const text = cardText(html, "lage-echt")
    expect(text).toContain(`Schwerpunkt ${directionWords(conf.center)}`)
    expect(text).toContain(
      `Abstand zur Mitte ${formatValue(Math.hypot(conf.center.xUm, conf.center.yUm) / 1000, 2)} mm`
    )
    expect(text).toContain(
      `Hotelling-T² ${formatValue(conf.t2, 1)} gegen ${formatValue(conf.critical, 1)} (95 %)`
    )
    expect(cardHtml(html, "lage-echt")).toContain(
      conf.real ? 'data-verdict="warn"' : 'data-verdict="none"'
    )
    expect(text).toContain(conf.real ? "echt versetzt" : "vom Zufall nicht zu unterscheiden")
  })

  it("Knopf Vertrauensellipse zeigt die Ebene der Scheibe und meldet sie", () => {
    expect(cardHtml(html, "lage-echt")).toMatch(
      /aria-pressed="false"[^>]*>(<svg.*?<\/svg>)?Vertrauensellipse/
    )
    const on = renderTab("position", { layers: { ellipse: true } })
    expect(cardHtml(on, "lage-echt")).toMatch(
      /aria-pressed="true"[^>]*>(<svg.*?<\/svg>)?Vertrauensellipse/
    )
    const onToggleLayer = vi.fn<(layer: Layer) => void>()
    const cards = positionCards({
      input: analysisInput(CARD, "decimal", LP_10M),
      explain: false,
      layers: initialViewState().layers,
      onToggleLayer,
    })
    const chip = findElement(
      cards.map((c) => c.element),
      ToggleChip
    )!
    ;(chip.props.onPressedChange as (pressed: boolean) => void)(true)
    expect(onToggleLayer).toHaveBeenCalledWith("ellipse")
  })

  it("Ringverlust nach Ursache: Balken Lage und Streuung, Ist, in der Mitte, Urteil", () => {
    const split = ringLossSplit(BASE, LP_10M)!
    const text = cardText(html, "ringverlust-nach-ursache")
    expect(text).toContain(`Lage ${formatValue(split.positionLoss.decimal, 1)}`)
    expect(text).toContain(`Streuung ${formatValue(split.spreadLoss.decimal, 1)}`)
    expect(text).toContain(`Ringverlust ${formatValue(split.total!.decimal, 1)} Ringe`)
    expect(text).toContain(`Ist ${formatValue(split.actual.decimal, 1)} Ringe`)
    expect(text).toContain(`Gruppe in der Mitte ${formatValue(split.centered.decimal, 1)} Ringe`)
    expect(text).toContain(split.reliable ? "belastbar" : "unsicher")
    const pos = Math.max(0, split.positionLoss.decimal)
    const spr = Math.max(0, split.spreadLoss.decimal)
    expect(styleOf(cardHtml(html, "ringverlust-nach-ursache"), 'data-split="spread"')).toBe(
      `width:${(spr / (pos + spr || 1)) * 100}%`
    )
  })

  it("kein Visier und keine Korrektur: der Reiter rechnet, er rät nicht zum Verstellen", () => {
    // User, 9. Oktober 2026: „visier raus“
    expect(html).not.toMatch(/Visier|Korrektur|verstellen/)
    expect(cardText(html, "lage-echt")).toContain(
      "Liegt die Mitte darin, ist ein Versatz nicht belegt."
    )
  })

  it("Drift: von-Neumann auf der Skala, Pfad mit einer Marke je Serie", () => {
    const d = drift(BASE)!
    const text = cardText(html, "drift-und-wanderung")
    expect(text).toContain(`von-Neumann-Verhältnis ${formatValue(d.vonNeumann, 2)}`)
    expect(styleOf(cardHtml(html, "drift-und-wanderung"), 'data-dot="true"')).toBe(
      `left:${(Math.min(4, d.vonNeumann) / 4) * 100}%`
    )
    const path = mpiPath(BASE)
    const marks = [...cardHtml(html, "drift-und-wanderung").matchAll(/data-path-series="(\d+)"/g)]
    expect(marks.map((m) => Number(m[1]))).toEqual(path.map((p) => p.series))
  })

  it("wenige Schüsse: der Grund statt eines Werts", () => {
    const few = renderTab("position", { shots: BASE.slice(0, 2) })
    expect(cardText(few, "lage-echt")).toContain("ab 3 Schuss")
    expect(cardText(few, "drift-und-wanderung")).toContain("ab 3 Schuss")
    const one = renderTab("position", { shots: BASE.slice(0, 1) })
    expect(cardText(one, "ringverlust-nach-ursache")).toContain("ab 2 Schuss mit Lage")
  })
})
