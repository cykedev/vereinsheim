import {
  cardTrend,
  mpiConfidence,
  ringLossSplit,
  shareAtLeast,
  sighterZeroed,
  sigmaEstimate,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { formatSigned, formatValue } from "../format"
import { analysisInput } from "./input"
import { observations } from "./observations"
import { overviewTiles } from "./overview"
import { fortyCard } from "./testCard"

const CARD = fortyCard()
const input = analysisInput(CARD, "decimal", LP_10M)
const base = input.base

describe("Überblick: acht Kacheln aus dem Fachkern", () => {
  const tiles = overviewTiles(input)
  const tile = (label: string) => tiles.find((t) => t.label === label)!

  it("die Kacheln der Spielwiese in ihrer Reihenfolge", () => {
    expect(tiles.map((t) => t.label)).toEqual([
      "Ergebnis",
      "Zehnerquote",
      "Präzision σ",
      "Lage",
      "Ringverlust",
      "Trend",
      "Tempo",
      "Probe → Wertung",
    ])
  })

  it("Werte gleich dem Fachkern, das Ergebnis wie in der Spielwiese", () => {
    expect(tile("Ergebnis").value).toBe("365,2")
    expect(tile("Ergebnis").hint).toMatch(/^Ø \d+,\d\d je Schuss · 40 Schuss$/)
    const tens = shareAtLeast(base, "decimal", 100)!
    expect(tile("Zehnerquote").value).toBe(formatValue(tens.rate * 100, 0))
    expect(tile("Präzision σ").value).toBe(formatValue(sigmaEstimate(base)!.sigma / 1000, 2))
    expect(tile("Lage").value).toBe(mpiConfidence(base)!.real ? "echt" : "unklar")
    expect(tile("Trend").value).toBe(formatSigned(cardTrend(base, "decimal")!.perTenShots, 2))
    expect(tile("Tempo").value).toBe(formatValue(tempoSpread(base)!.medianMs / 1000, 0))
    expect(tile("Probe → Wertung").value).toBe(
      formatValue(sighterZeroed(CARD)!.matchOffsetUm! / 1000, 2)
    )
  })

  it("in ganzen Ringen ein ganzzahliges Ergebnis", () => {
    const rings = overviewTiles(analysisInput(CARD, "rings", LP_10M))
    expect(rings[0].value).toMatch(/^\d+$/)
  })

  it("ohne Wert ein Strich und der Grund", () => {
    const few = overviewTiles(analysisInput(CARD.slice(9, 11), "decimal", LP_10M))
    const t = (label: string) => few.find((x) => x.label === label)!
    expect(t("Präzision σ").value).toBeNull()
    expect(t("Präzision σ").hint).toBe("ab 3 Schuss")
    expect(t("Trend").hint).toBe("ab 10 Schuss")
    expect(t("Tempo").hint).toBe("ab 4 Schuss mit Zeit")
    expect(t("Probe → Wertung").hint).toBe("ab 3 Probe- und 3 Wertungsschüssen")
  })

  it("fehlt einem Schuss der Wert, nennt die Kachel Ergebnis das statt der Mindestzahl", () => {
    const blind = CARD.map((s, i) => (i === 20 ? { ...s, decimalTenths: null, ring: null } : s))
    const t = overviewTiles(analysisInput(blind, "decimal", LP_10M)).find(
      (x) => x.label === "Ergebnis"
    )!
    expect(t.value).toBeNull()
    expect(t.hint).toBe("nicht jeder Schuss mit Wert")
  })
})

describe("Beobachtungen in Worten", () => {
  const sentences = observations(input)

  it("mindestens fünf Sätze, in der Reihenfolge der Spielwiese", () => {
    expect(sentences.length).toBeGreaterThanOrEqual(5)
    expect(sentences[0].icon).toBe("position")
    expect(sentences[0].text).toMatch(
      mpiConfidence(base)!.real ? /^Die Lage ist echt/ : /vom Zufall nicht zu unterscheiden/
    )
    expect(sentences.map((s) => s.icon)).toContain("spread")
  })

  it("Lage echt: der Gewinn in der Mitte mit seinem n und je Schuss, ohne Visier", () => {
    // 2,8 Ringe sind die Summe über 40 Schuss, nicht der Gewinn eines Schusses (Prüfung, Ergebnis 1)
    expect(ringLossSplit(base, LP_10M)!.reliable).toBe(true)
    expect(sentences[0].text).toContain(
      "Läge die Gruppe in der Mitte, brächten 40 weitere Schuss zusammen etwa 2,8 Ringe mehr (rund 0,07 je Schuss)."
    )
    const rings = observations(analysisInput(CARD, "rings", LP_10M))
    expect(rings[0].text).toContain(
      "brächten 40 weitere Schuss zusammen etwa 4 Ringe mehr (rund 0,10 je Schuss)."
    )
    for (const s of [...sentences, ...rings]) expect(s.text).not.toMatch(/Visier|Korrektur/)
  })

  it("Lage echt, in ganzen Ringen ohne Gewinn: die Mitte brächte keine Ringe", () => {
    // zwölf Treffer eng um (2 | 0) mm: echt versetzt, aber jeder schon eine Zehn auf der Luftpistole
    const shots = Array.from({ length: 12 }, (_, i) => {
      const xUm = 2000 + (i % 2 ? 200 : -200) * (1 + (i % 3))
      const yUm = (i % 4 < 2 ? 200 : -200) * (1 + (i % 3))
      const score = scoreFromCoordinates(LP_10M, xUm, yUm)
      return {
        seq: i + 1,
        xUm,
        yUm,
        decimalTenths: score.decimalTenths,
        ring: score.ring,
        innerTen: score.innerTen,
        firedAtMs: null,
        kind: "match" as const,
        series: 1,
      }
    })
    const split = ringLossSplit(shots, LP_10M)!
    expect(split.reliable).toBe(true)
    expect(split.positionLoss.rings).toBe(0)
    const text = observations(analysisInput(shots, "rings", LP_10M))[0].text
    expect(text).toContain("In der Mitte brächte die Gruppe keine Ringe mehr.")
  })

  it("Lage nicht echt: kein Grund zum Verstellen, nur kein Beleg", () => {
    const centered = CARD.map((s) =>
      s.kind === "match" && s.xUm !== null && s.yUm !== null
        ? { ...s, xUm: s.xUm + 3500, yUm: s.yUm - 2200 }
        : s
    )
    const text = observations(analysisInput(centered, "decimal", LP_10M))[0].text
    expect(text).toMatch(
      /vom Zufall ist das nicht zu unterscheiden\. Ein Versatz ist nicht belegt\.$/
    )
  })

  it("die Pause vor Schuss 21 erkannt", () => {
    const pause = sentences.find((s) => s.icon === "pause")
    expect(pause?.text).toContain("der Pause vor Schuss 21")
    expect(pause?.text).toMatch(/^Nach der Pause/)
  })

  it("Probe gegen Wertung ohne Verstellung", () => {
    const flag = sentences.find((s) => s.icon === "flag")
    expect(flag?.text).toMatch(/^Probe: Ø \d+,\d\d je Schuss gegen \d+,\d\d in der Wertung\./)
    expect(sentences.map((s) => s.text).join(" ")).not.toContain("Verstellung")
  })

  it("der Trend nennt den Wert je Schuss alle zehn Schuss und je Zehnerserie das Zehnfache", () => {
    const trend = cardTrend(base, "decimal")!
    const text = sentences.find((s) => s.icon === "trend")!.text
    // nicht „Ringe je zehn Schuss“: das las sich als Summe der Serie (User, 9. Oktober 2026)
    expect(text).not.toContain("je zehn Schuss")
    expect(text).toContain(
      trend.clear
        ? `um ${formatValue(Math.abs(trend.perTenShots), 2)} Ringe alle zehn Schuss, eine Zehnerserie um ${formatValue(Math.abs(trend.perTenShots * 10), 1)} Ringe`
        : `Wert je Schuss ${formatSigned(trend.perTenShots, 2)} Ringe alle zehn Schuss, je Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} Ringe`
    )
  })

  it("ohne drei Wertungsschüsse keine Sätze", () => {
    expect(observations(analysisInput(CARD.slice(9, 11), "decimal", LP_10M))).toEqual([])
  })
})
