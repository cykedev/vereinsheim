import { drift, mpiConfidence, mpiPath, ringLossSplit } from "@vereinsheim/shot-core/analysis"
import { FLAG_SUSPICIOUS } from "@vereinsheim/shot-core/metrics"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { isValidElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { directionWords, formatValue } from "../../format"
import { initialViewState, type Layer } from "../../view-state"
import { analysisInput } from "../input"
import { fortyCard, withSighterAfter } from "../testCard"
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
    expect(text).toContain(conf.real ? "sicher versetzt" : "kann Zufall sein")
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
    expect(html).not.toMatch(/Visier|Korrektur|verstellen/)
    expect(cardText(html, "lage-echt")).toContain(
      "Liegt die Mitte darin, ist ein Versatz nicht belegt."
    )
  })

  it("ohne Ringverlust: Ist und Mitte nennen ihr n, der Grund nennt den verdächtigen Schuss", () => {
    // ein verdächtiger Schuss mit Lage zählt nicht (SF-15)
    const suspicious = CARD.map((s, i) => (i === 20 ? { ...s, flags: [FLAG_SUSPICIOUS] } : s))
    const split = ringLossSplit(
      suspicious.filter((s) => s.kind === "match"),
      LP_10M
    )!
    expect(split.total).toBeNull()
    const text = cardText(renderTab("position", { shots: suspicious }), "ringverlust-nach-ursache")
    expect(text).toContain(
      "Ringverlust – nicht jeder Wertungsschuss mit gültiger Lage (fehlt oder verdächtig)"
    )
    expect(text).toContain(`Ist (39 Schuss mit Lage) ${formatValue(split.actual.decimal, 1)} Ringe`)
    expect(text).toContain(
      `Gruppe in der Mitte (39 Schuss mit Lage) ${formatValue(split.centered.decimal, 1)} Ringe`
    )
  })

  it("Ellipse auf der Scheibe und Urteil: wofür jedes gilt", () => {
    expect(cardText(html, "lage-echt")).toContain(
      "Auf der Scheibe gilt die Ellipse für die Auswahl dort; dieses Urteil für alle Wertungsschüsse."
    )
  })

  it("Drift über eine späte Probe: die Probe ist keine Lücke (SF-04)", () => {
    const shots = withSighterAfter(CARD, 7)
    const base = shots.filter((s) => s.kind === "match")
    const withCard = formatValue(drift(base, shots)!.vonNeumann, 2)
    expect(withCard).not.toBe(formatValue(drift(base)!.vonNeumann, 2))
    expect(cardText(renderTab("position", { shots }), "drift-und-wanderung")).toContain(withCard)
  })

  it("Wandern und Pfad: was unter und über 2 heißt, wie weit Serien ohne Wandern liegen", () => {
    const text = cardText(html, "drift-und-wanderung")
    expect(text).toContain(
      "Um 2 sind die Schüsse unabhängig. Deutlich darunter liegen aufeinanderfolgende Treffer näher beieinander, als die Gruppe breit ist: Die Gruppe wandert langsam, oder mehrere Ausreißer folgen direkt aufeinander. Über 2 springen aufeinanderfolgende Treffer eher hin und her."
    )
    // B12: im Mittel 0,35 σ
    expect(text).toContain(
      "Auch ohne Wandern liegt der Schwerpunkt einer Zehnerserie im Mittel etwa ein Drittel σ neben dem der Scheibe."
    )
  })

  it("negativer Lage-Anteil: „Lage kostet nichts“, die Zahl mit ihrem Grund in einem Satz", () => {
    // die Gruppe sitzt um die Mitte, das Verschieben um den Zufallsversatz kostet
    const calm = BASE.map((s) =>
      s.xUm === null || s.yUm === null ? s : { ...s, xUm: s.xUm + 3500, yUm: s.yUm - 2200 }
    )
    const split = ringLossSplit(calm, LP_10M)!
    expect(split.positionLoss.decimal).toBeLessThan(0)
    const card = cardHtml(renderTab("position", { shots: calm }), "ringverlust-nach-ursache")
    // die Streuung trägt den ganzen Ringverlust, Lage und Streuung ergeben ihn zusammen
    expect(card).toContain(
      `aria-label="Lage kostet nichts, Streuung ${formatValue(split.total!.decimal, 1)} Ringe"`
    )
    const text = cardText(renderTab("position", { shots: calm }), "ringverlust-nach-ursache")
    expect(text).toContain("Lage kostet nichts")
    // die Legende nennt keine Zahl, nur der Satz mit dem Grund
    expect(text).toContain(`Lage kostet nichts Streuung ${formatValue(split.total!.decimal, 1)}`)
    expect(text).toContain(
      `Deine Gruppe sitzt schon gut; in die Mitte geschoben brächte sie rechnerisch nichts (Lage ${formatValue(split.positionLoss.decimal, 1)} Ringe).`
    )
    expect(cardText(html, "ringverlust-nach-ursache")).not.toContain("kostet nichts")
    // dieselbe Gruppe um die Mitte: der Versatz ist nicht belegt
    expect(mpiConfidence(calm)!.real).toBe(false)
    expect(cardText(renderTab("position", { shots: calm }), "lage-echt")).toContain(
      "kann Zufall sein"
    )
    expect(cardText(html, "lage-echt")).not.toContain("kann Zufall sein")
    expect(cardText(html, "ringverlust-nach-ursache")).not.toContain("sitzt schon gut")
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
    expect(cardText(few, "lage-echt")).toContain(
      "ab 3 Schuss mit Lage (nicht alle auf einer Linie)"
    )
    // drei auf einer Linie: kein Test möglich, derselbe Grund
    const line = [0, 1, 2].map((i) => ({ ...BASE[i], xUm: 1000 * i, yUm: 500 * i }))
    expect(mpiConfidence(line)).toBeNull()
    expect(cardText(renderTab("position", { shots: line }), "lage-echt")).toContain(
      "ab 3 Schuss mit Lage (nicht alle auf einer Linie)"
    )
    expect(cardText(few, "drift-und-wanderung")).toContain("ab 3 Schuss")
    const one = renderTab("position", { shots: BASE.slice(0, 1) })
    expect(cardText(one, "ringverlust-nach-ursache")).toContain("ab 2 Schuss mit Lage")
  })
})
