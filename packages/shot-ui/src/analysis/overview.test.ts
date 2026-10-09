import {
  cardTrend,
  fatigue,
  mpiConfidence,
  pauseRecovery,
  ringLossSplit,
  shareAtLeast,
  sighterZeroed,
  sigmaEstimate,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import {
  computeMetric,
  FLAG_SUSPICIOUS,
  inScoring,
  metricByKey,
} from "@vereinsheim/shot-core/metrics"
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
      "Eingeschossen?",
    ])
  })

  it("Werte gleich dem Fachkern, das Ergebnis wie in der Spielwiese", () => {
    expect(tile("Ergebnis").value).toBe("365,2")
    expect(tile("Ergebnis").hint).toMatch(/^Ø \d+,\d\d je Schuss · 40 Schuss$/)
    const tens = shareAtLeast(base, "decimal", 100)!
    expect(tile("Zehnerquote").value).toBe(formatValue(tens.rate * 100, 0))
    expect(tile("Präzision σ").value).toBe(formatValue(sigmaEstimate(base)!.sigma / 1000, 2))
    expect(tile("Lage").value).toBe(mpiConfidence(base)!.real ? "echt" : "unklar")
    const trend = cardTrend(base, "decimal")!
    expect(tile("Trend").value).toBe(formatSigned(trend.perTenShots, 2))
    // Ringe je Schuss alle zehn Schuss, nicht „je 10“ (Prüfung, Zeit 3)
    expect(tile("Trend").unit).toBe("Ringe")
    expect(tile("Trend").hint).toBe(
      `je Schuss alle 10 Schuss · Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} Ringe · ${trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"} (95 %)` : "nicht klar"}`
    )
    // der Median wie Reiter und Kachel an der Scheibe: aus der Registry, ab 3 Schuss mit Zeit (Review)
    expect(tile("Tempo").value).toBe(
      formatValue(computeMetric(metricByKey("time.intervalMedian")!, base)!, 0)
    )
    expect(tile("Tempo").hint).toBe(
      `Median · mittlere Hälfte in ${formatValue(tempoSpread(base)!.iqrMs / 1000, 0)} s`
    )
    // D3: das Urteil von S4 statt des Abstands, der auch ohne Verschiebung groß ausfällt (B21)
    const zeroed = sighterZeroed(CARD)!
    expect(tile("Eingeschossen?").value).toBe(zeroed.real ? "versetzt" : "unklar")
    expect(tile("Eingeschossen?").unit).toBe("")
    expect(tile("Eingeschossen?").hint).toBe(
      zeroed.real
        ? `echt neben der Mitte · letzte ${zeroed.n} Probeschüsse`
        : `kein Versatz nachweisbar · letzte ${zeroed.n} Probeschüsse`
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
    // wie der Reiter Lage: drei auf einer Linie haben keinen Test (Review)
    expect(t("Lage").hint).toBe("ab 3 Schuss mit Lage (nicht alle auf einer Linie)")
    expect(t("Trend").hint).toBe("ab 10 Schuss")
    expect(t("Tempo").hint).toBe("ab 3 Schuss mit Zeit")
    const three = overviewTiles(analysisInput(CARD.slice(9, 12), "decimal", LP_10M))
    const tempo = three.find((x) => x.label === "Tempo")!
    expect(tempo.value).not.toBeNull()
    expect(tempo.hint).toBe("Median")
    expect(t("Eingeschossen?").hint).toBe("ab 3 Probeschüssen mit Lage vor der Wertung")
    // ein Training nur aus Probe ist kein Einschießen (Prüfung, Probe 6)
    const probes = CARD.filter((s) => s.kind === "probe")
    const training = overviewTiles(analysisInput(probes, "decimal", LP_10M)).at(-1)!
    expect(training.value).toBeNull()
    expect(training.hint).toBe("Training nur mit Probe")
  })

  it("fehlt einem Schuss der Wert, nennt die Kachel Ergebnis den Ø und den Grund", () => {
    const blind = CARD.map((s, i) => (i === 20 ? { ...s, decimalTenths: null, ring: null } : s))
    const input = analysisInput(blind, "decimal", LP_10M)
    const mean = computeMetric(
      inScoring(metricByKey("result.decimalMean")!, "decimal"),
      input.base
    )!
    const t = overviewTiles(input).find((x) => x.label === "Ergebnis")!
    expect(t.value).toBeNull()
    expect(t.hint).toBe(
      `Ø ${formatValue(mean, 2)} je Schuss (39 mit Zehntel) · nicht jeder Schuss mit Wert`
    )
    const tenthless = CARD.map((s, i) => (i === 20 ? { ...s, decimalTenths: null } : s))
    expect(
      overviewTiles(analysisInput(tenthless, "decimal", LP_10M)).find(
        (x) => x.label === "Ergebnis"
      )!.hint
    ).toMatch(/ · nicht jeder Schuss mit Zehntel · auf ganze Ringe schalten$/)
  })

  it("ein verdächtiger Schuss mit Lage: kein Ringverlust, der Grund nennt beides", () => {
    // Prüfung, Ergebnis 6: der Schuss hat eine Lage, zählt aber nicht (SF-15)
    const suspicious = CARD.map((s, i) => (i === 20 ? { ...s, flags: [FLAG_SUSPICIOUS] } : s))
    const t = overviewTiles(analysisInput(suspicious, "decimal", LP_10M)).find(
      (x) => x.label === "Ringverlust"
    )!
    expect(t.value).toBeNull()
    expect(t.hint).toBe("nicht jeder Wertungsschuss mit gültiger Lage (fehlt oder verdächtig)")
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

  it("ein Ausreißer: „Er kostet“, mehrere: „Sie kosten“ (Prüfung, Grammatik)", () => {
    const outlier = sentences.find((s) => s.icon === "outlier")!.text
    expect(outlier).toMatch(
      /^Schuss 27 fällt als Ausreißer aus der Gruppe\. Er kostet \d+,\d Ringe? gegen deinen typischen Schuss\.$/
    )
    const far = scoreFromCoordinates(LP_10M, 27000, -33000)
    const two = CARD.map((s, i) =>
      i === 9 + 30
        ? { ...s, xUm: 27000, yUm: -33000, decimalTenths: far.decimalTenths, ring: far.ring }
        : s
    )
    const both = observations(analysisInput(two, "decimal", LP_10M)).find(
      (s) => s.icon === "outlier"
    )!.text
    expect(both).toMatch(/^Die Schüsse 27, 31 fallen als Ausreißer aus der Gruppe\. Sie kosten /)
  })

  it("die Pause vor Schuss 21: bis zu drei Schüsse danach, je Schuss gegen die übrigen", () => {
    // nicht „unter dem Schnitt der Scheibe“ und nicht „die nächsten drei“ (Prüfung, Zeit 1)
    const delta = pauseRecovery(base, "decimal")!.effects[0].deltaRings!
    const pause = sentences.find((s) => s.icon === "pause")!.text
    expect(pause).toMatch(
      new RegExp(
        `^Nach der Pause vor Schuss 21 lagen die Schüsse danach \\(bis zu drei\\) im Schnitt ${formatValue(Math.abs(delta), 2)} Ringe je Schuss ${delta < 0 ? "unter" : "über"} deinen übrigen Schüssen\\.`
      )
    )
    expect(pause).not.toContain("Schnitt der Scheibe")
  })

  it("haben die Schüsse nach der Pause keinen Wert, sagt der Satz das statt einer Zahl", () => {
    // Wertungsschüsse 21 bis 23 ohne Zehntel: die Pause bleibt, die Wirkung fehlt (Review)
    const blind = CARD.map((s, i) => (i >= 29 && i <= 31 ? { ...s, decimalTenths: null } : s))
    const pause = observations(analysisInput(blind, "decimal", LP_10M)).find(
      (s) => s.icon === "pause"
    )!.text
    expect(pause).toMatch(/^Nach der Pause vor Schuss 21 fehlen Werte zum Vergleich\./)
    expect(pause).not.toContain("NaN")
  })

  it("Ermüdung je Schuss und zusammen über zehn Schuss (Prüfung, Zeit 4)", () => {
    const tired = fatigue(base, "decimal")!
    const text = sentences.find((s) => s.icon === "trend")!.text
    expect(text).toContain(
      `Die letzten zehn Schuss lagen im Schnitt ${formatValue(Math.abs(tired.deltaRings), 2)} Ringe je Schuss ${tired.deltaRings < 0 ? "unter" : "über"} den ersten zehn (zusammen ${formatSigned(tired.deltaRings * 10, 1)} Ringe), R50 ${formatSigned(tired.deltaR50Um! / 1000, 2)} mm.`
    )
  })

  it("Probe gegen Wertung ohne Verstellung", () => {
    const flag = sentences.find((s) => s.icon === "flag")
    expect(flag?.text).toMatch(/^Probe: Ø \d+,\d\d je Schuss gegen \d+,\d\d in der Wertung\./)
    expect(sentences.map((s) => s.text).join(" ")).not.toContain("Verstellung")
  })

  it("echt versetzte letzte Probe: Richtung und Abstand, keine Behauptung über die Wertung", () => {
    // fünf Probeschüsse eng um (3 | 3) mm, danach die Wertung der Testkarte (Prüfung, Probe 1)
    const offset = CARD.map((s, i) =>
      i >= 4 && i < 9
        ? { ...s, xUm: 3000 + (i % 2 ? 100 : -100), yUm: 3000 + (i % 3) * 100 - 100 }
        : s
    )
    const zeroed = sighterZeroed(offset)!
    expect(zeroed.real).toBe(true)
    const text = observations(analysisInput(offset, "decimal", LP_10M)).find(
      (s) => s.icon === "flag"
    )!.text
    expect(text).toContain(
      `Die letzten fünf Probeschüsse lagen echt neben der Mitte (rechts oben, ${formatValue(zeroed.offsetUm / 1000, 2)} mm).`
    )
    expect(text).not.toContain("Wertung begann")
  })

  it("drei Probeschüsse: der Satz nennt drei", () => {
    const three = CARD.filter((s, i) => s.kind === "match" || i >= 6)
    const text = observations(analysisInput(three, "decimal", LP_10M)).find(
      (s) => s.icon === "flag"
    )!.text
    expect(text).toContain("Bei den letzten drei Probeschüssen ist kein Versatz nachweisbar.")
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
