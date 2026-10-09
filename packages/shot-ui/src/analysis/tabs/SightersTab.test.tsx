import { sighterComparison, sighterSummary, sighterZeroed } from "@vereinsheim/shot-core/analysis"
import { describe, expect, it } from "vitest"

import { directionName, durationText, formatValue } from "../../format"
import { probeOnlyAsMatch } from "../../shots"
import { fortyCard } from "../testCard"
import { cardHtml, cardText, renderTab } from "../testPanel"

const CARD = fortyCard()
const PROBES = CARD.filter((s) => s.kind === "probe")
const BASE = CARD.filter((s) => s.kind === "match")
const mm = (um: number) => formatValue(um / 1000, 2)
const labels = (html: string) =>
  [...cardHtml(html, "probe-auf-der-scheibe").matchAll(/data-sighter="(P\d+)"/g)].map((m) => m[1])

describe("Reiter Probe", () => {
  const html = renderTab("sighters")

  it("Umfang der Probe aus dem Fachkern", () => {
    const summary = sighterSummary(CARD)!
    const text = cardText(html, "probe-umfang")
    expect(text).toContain(`Probeschüsse ${summary.count} (${summary.blocks} Block à zehn)`)
    expect(text).toContain(`Dauer der Probe ${durationText(summary.durationMs!)}`)
    // gemessen ab dem ersten Probeschuss (Prüfung, Probe 9)
    expect(text).toContain(
      `Vom ersten Probeschuss bis zur Wertung ${durationText(summary.untilMatchMs!)}`
    )
  })

  it("Probe gegen Wertung: je Seite Schuss, Ø, R50 und σ", () => {
    const cmp = sighterComparison(CARD, "decimal")!
    const card = cardHtml(html, "probe-gegen-wertung")
    for (const [name, side] of [
      ["probe", cmp.probe],
      ["match", cmp.match],
    ] as const) {
      const row = card.match(new RegExp(`<tr data-side="${name}"[^>]*>(.*?)</tr>`))![1]
      const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => m[1])
      expect(cells).toEqual([
        String(side.n),
        side.meanRings === null ? "–" : formatValue(side.meanRings, 2),
        side.r50Um === null ? "–" : mm(side.r50Um),
        side.sigmaUm === null ? "–" : mm(side.sigmaUm),
      ])
    }
  })

  it("Eingeschossen? mit Lage der letzten fünf, Versatz zur Wertung und Urteil", () => {
    const zero = sighterZeroed(CARD)!
    const text = cardText(html, "eingeschossen")
    // eine Rundung, nicht „0,5 mm rechts (0,47 mm)“ (Prüfung, Probe 11)
    expect(text).toContain(
      `Lage der letzten fünf Probeschüsse ${directionName(zero.center)}, ${mm(zero.offsetUm)} mm`
    )
    expect(text).toContain(`Versatz Probe → Wertung ${mm(zero.matchOffsetUm!)} mm`)
    // D3: der Abstand ohne jede Verschiebung, mit seinem Bezug (B21)
    expect(text).toContain(
      "Aus fünf Probeschüssen ist ihr Schwerpunkt unsicher: Auch ohne jede Verschiebung liegt der Abstand zur Wertung bei fünf Probeschüssen meist bei etwa einem halben σ, in 5 von 100 Fällen über gut einem σ."
    )
    expect(cardHtml(html, "eingeschossen")).toContain(
      zero.real ? 'data-verdict="warn"' : 'data-verdict="none"'
    )
  })

  it("drei Probeschüsse mit Lage: die Karte nennt drei, nicht fünf (Prüfung, Probe 5)", () => {
    const three = CARD.filter((s, i) => s.kind === "match" || i >= 6)
    expect(sighterZeroed(three)!.n).toBe(3)
    const text = cardText(renderTab("sighters", { shots: three }), "eingeschossen")
    expect(text).toContain("Lage der letzten drei Probeschüsse")
    expect(text).toContain("Aus drei Probeschüssen ist ihr Schwerpunkt unsicher")
    expect(text).not.toContain("fünf Probeschüssen mit Lage")
  })

  it("Probe erst nach Beginn der Wertung: sie zählt hier nicht, und das steht da (Prüfung, Probe 4)", () => {
    const late = [
      ...BASE.slice(0, 1),
      ...PROBES.map((s) => ({ ...s, seq: (s.seq ?? 0) + 100 })),
      ...BASE.slice(1),
    ]
    const page = renderTab("sighters", { shots: late })
    const note = "Keine Probeschüsse vor der Wertung; Probe nach ihrem Beginn zählt hier nicht."
    expect(cardText(page, "probe-umfang")).toContain(note)
    expect(cardText(page, "probe-auf-der-scheibe")).toContain(note)
  })

  it("keine Erwähnung einer Visierverstellung", () => {
    expect(html).not.toMatch(/Verstellung|verstellt/)
  })

  it("Probe auf der Scheibe: in Abgabefolge, auch bei vertauschter Liste, nur mit Lage", () => {
    const names = PROBES.map((_, i) => `P${i + 1}`)
    expect(labels(html)).toEqual(names)
    expect(labels(renderTab("sighters", { shots: [...CARD].reverse() }))).toEqual(names)
    const blind = CARD.map((s) => (s === PROBES[2] ? { ...s, xUm: null, yUm: null } : s))
    expect(labels(renderTab("sighters", { shots: blind }))).toEqual(names.filter((n) => n !== "P3"))
    expect(cardHtml(html, "probe-auf-der-scheibe")).toContain('data-overlay="mpi"')
  })

  it("Probe auf der Scheibe: Nummer am Schuss, ohne Überlappung, jeder Kreis ganz im Bild", () => {
    // P2 auf die Stelle von P4: zwei Nummern an einem Punkt müssen ausweichen
    const p4 = PROBES[3]
    const shots = CARD.map((s) => (s === PROBES[1] ? { ...s, xUm: p4.xUm, yUm: p4.yUm } : s))
    for (const page of [html, renderTab("sighters", { shots })]) {
      const card = cardHtml(page, "probe-auf-der-scheibe")
      const chart = /<svg[^>]*aria-label="Probeschüsse um die Mitte"[^>]*>/.exec(card)![0]
      const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(chart)!.map(Number)
      const circles = new Map(
        [
          ...card.matchAll(
            /data-sighter="(P\d+)"><circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g
          ),
        ].map((m) => [m[1], [Number(m[2]), Number(m[3]), Number(m[4])]])
      )
      const texts = [
        ...card.matchAll(/data-sighter-label="(P\d+)" x="([-\d.]+)" y="([-\d.]+)"/g),
      ].map((m) => ({ label: m[1], x: Number(m[2]), y: Number(m[3]) }))
      expect(texts).toHaveLength(PROBES.length)
      for (const t of texts) {
        const [cx, cy, r] = circles.get(t.label)!
        expect(t.x).toBe(cx)
        // auf dem Schuss oder, wenn sie ausweicht, höchstens drei Zeilen darüber oder darunter
        expect(Math.abs(t.y - cy)).toBeLessThanOrEqual(3 * 14)
        expect(cx - r).toBeGreaterThanOrEqual(0)
        expect(cx + r).toBeLessThanOrEqual(w)
        expect(cy - r).toBeGreaterThanOrEqual(0)
        expect(cy + r).toBeLessThanOrEqual(h)
      }
      for (const [i, a] of texts.entries())
        for (const b of texts.slice(i + 1))
          expect(
            Math.abs(a.x - b.x) >= 19 || Math.abs(a.y - b.y) >= 14,
            `${a.label}/${b.label}`
          ).toBe(true)
    }
  })

  it("ohne Probe der Hinweis; nur Probe zählt wie Wertung", () => {
    const none = renderTab("sighters", { shots: BASE })
    expect(cardText(none, "probe-umfang")).toContain("Keine Probeschüsse.")
    expect(cardText(none, "probe-gegen-wertung")).toContain("Braucht Probe- und Wertungsschüsse.")
    expect(cardText(none, "probe-auf-der-scheibe")).toContain("Keine Probeschüsse.")
    const training = renderTab("sighters", { shots: probeOnlyAsMatch(PROBES) })
    expect(cardText(training, "probe-umfang")).toContain(
      "Nur Probeschüsse: Die anderen Reiter rechnen über sie wie über Wertung."
    )
    // auch ungewandelt: ein Training nur aus Probe ist kein Einschießen (Prüfung, Probe 6)
    for (const shots of [probeOnlyAsMatch(PROBES), PROBES]) {
      expect(cardText(renderTab("sighters", { shots }), "eingeschossen")).toContain(
        "Nur Probeschüsse: Die anderen Reiter rechnen über sie wie über Wertung."
      )
    }
  })
})
