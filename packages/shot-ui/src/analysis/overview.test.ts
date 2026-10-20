import {
  cardTrend,
  fatigue,
  mpiConfidence,
  outliers,
  pauseRecovery,
  ringLossSplit,
  shareAtLeast,
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

import { directionName, formatSigned, formatValue } from "../format"
import { asOnPrintout } from "../shots"
import { analysisInput } from "./input"
import { observations } from "./observations"
import { overviewTiles } from "./overview"
import { fortyCard, withSighterAfter } from "./testCard"

const CARD = fortyCard()
const input = analysisInput(CARD, "decimal", LP_10M)
const base = input.base

describe("Überblick: acht Kacheln aus dem Fachkern", () => {
  const tiles = overviewTiles(input)
  const tile = (label: string) => tiles.find((t) => t.label === label)!

  it("die acht Kacheln in ihrer Reihenfolge", () => {
    expect(tiles.map((t) => t.label)).toEqual([
      "Ergebnis",
      "Zehnerquote",
      "Streuung",
      "Lage",
      "Ringverlust",
      "Trend",
      "Tempo",
      "Ausreißer",
    ])
  })

  it("Werte gleich dem Fachkern, das Ergebnis der Testkarte", () => {
    expect(tile("Ergebnis").value).toBe("365,2")
    expect(tile("Ergebnis").hint).toMatch(/^Ø \d+,\d\d je Schuss · 40 Schuss$/)
    const tens = shareAtLeast(base, "decimal", 100)!
    expect(tile("Zehnerquote").value).toBe(formatValue(tens.rate * 100, 0))
    expect(tile("Streuung").value).toBe(formatValue(sigmaEstimate(base)!.sigma / 1000, 2))
    const sigma = sigmaEstimate(base)!
    expect(tile("Streuung").hint).toBe(
      `sicher ${formatValue(sigma.low / 1000, 2)} bis ${formatValue(sigma.high / 1000, 2)} mm`
    )
    expect(tile("Zehnerquote").hint).toMatch(/^\d+ von \d+ · sicher \d+ % bis \d+ %$/)
    const confidence = mpiConfidence(base)!
    expect(tile("Lage").value).toBe(confidence.real ? "versetzt" : "passt")
    // nur die Richtung, ohne Zahlen und ohne T²: die Zahlen stehen in der Beobachtung
    expect(tile("Lage").hint).toBe(
      confidence.real ? directionName(confidence.center) : "kein Versatz belegt"
    )
    const trend = cardTrend(base, "decimal")!
    expect(tile("Trend").value).toBe(formatSigned(trend.perTenShots, 2))
    // Ringe je Schuss alle zehn Schuss, nicht „je 10“
    expect(tile("Trend").unit).toBe("Ringe")
    expect(tile("Trend").hint).toBe(
      `je Schuss alle 10 Schuss · Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} Ringe · ${trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"}` : "nicht klar"}`
    )
    // der Median wie Reiter und Kachel an der Scheibe: aus der Registry, ab 3 Schuss mit Zeit
    expect(tile("Tempo").value).toBe(
      formatValue(computeMetric(metricByKey("time.intervalMedian")!, base)!, 0)
    )
    expect(tile("Tempo").hint).toBe(
      `die Hälfte in ${formatValue(tempoSpread(base)!.iqrMs / 1000, 0)} s`
    )
    // die Ausreißer: wie viele und welche (der Abreißer Schuss 27)
    const flagged = outliers(base)!
    expect(flagged.flagged.map((o) => o.number)).toEqual([27])
    expect(tile("Ausreißer").value).toBe("1")
    expect(tile("Ausreißer").unit).toBe("")
    // die Nummer steht im Kopf und in der Beobachtung, die Kachel zählt nur (wie bei der Lage)
    expect(tile("Ausreißer").hint).toBe("fällt aus der Gruppe")
  })

  it("in ganzen Ringen ein ganzzahliges Ergebnis", () => {
    const rings = overviewTiles(analysisInput(CARD, "rings", LP_10M))
    expect(rings[0].value).toMatch(/^\d+$/)
  })

  it("ohne Wert ein Strich und der Grund", () => {
    const few = overviewTiles(analysisInput(CARD.slice(9, 11), "decimal", LP_10M))
    const t = (label: string) => few.find((x) => x.label === label)!
    expect(t("Streuung").value).toBeNull()
    expect(t("Streuung").hint).toBe("ab 3 Schuss")
    // wie der Reiter Lage: drei auf einer Linie haben keinen Test
    expect(t("Lage").hint).toBe("ab 3 Schuss mit Lage (nicht alle auf einer Linie)")
    expect(t("Trend").hint).toBe("ab 10 Schuss")
    expect(t("Tempo").hint).toBe("ab 3 Schuss mit Zeit")
    const three = overviewTiles(analysisInput(CARD.slice(9, 12), "decimal", LP_10M))
    const tempo = three.find((x) => x.label === "Tempo")!
    expect(tempo.value).not.toBeNull()
    expect(tempo.hint).toBe("")
    expect(t("Ausreißer").value).toBeNull()
    expect(t("Ausreißer").hint).toBe("ab 5 Schuss mit Lage")
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
    // der Schuss hat eine Lage, zählt aber nicht (SF-15)
    const suspicious = CARD.map((s, i) => (i === 20 ? { ...s, flags: [FLAG_SUSPICIOUS] } : s))
    const t = overviewTiles(analysisInput(suspicious, "decimal", LP_10M)).find(
      (x) => x.label === "Ringverlust"
    )!
    expect(t.value).toBeNull()
    expect(t.hint).toBe("nicht jeder Wertungsschuss mit gültiger Lage (fehlt oder verdächtig)")
  })
})

describe("Überblick mit einer späten Probe (SF-04)", () => {
  it("Tempo von Wertungsschuss zu Wertungsschuss, die Probe dazwischen ist keine Lücke", () => {
    const late = analysisInput(withSighterAfter(CARD, 5), "decimal", LP_10M)
    const median = metricByKey("time.intervalMedian")!
    const tempo = overviewTiles(late).find((t) => t.label === "Tempo")!
    const withCard = formatValue(computeMetric(median, late.base, late.card)!, 0)
    expect(tempo.value).toBe(withCard)
    // ohne die Karte fiele der Abstand über die Probe weg: ein anderer Median
    expect(withCard).not.toBe(formatValue(computeMetric(median, late.base)!, 0))
    expect(tempo.hint).toBe(
      `die Hälfte in ${formatValue(tempoSpread(late.base, late.card)!.iqrMs / 1000, 0)} s`
    )
  })
})

describe("auf dem Weg der Seite: gedruckte Karte, die rohe als Kontext (SF-04)", () => {
  const page = (raw: ReturnType<typeof withSighterAfter>) =>
    analysisInput(asOnPrintout(raw), "decimal", LP_10M, raw)

  it("eine späte Probe mitten im Takt: dasselbe Tempo wie über die rohe Karte", () => {
    const raw = withSighterAfter(CARD, 7)
    const tempo = (i: ReturnType<typeof analysisInput>) =>
      overviewTiles(i).find((t) => t.label === "Tempo")!.value
    expect(page(raw).base.some((s) => s.kind === "probe")).toBe(false)
    expect(tempo(page(raw))).toBe(tempo(analysisInput(raw, "decimal", LP_10M)))
    // ohne Kontext risse die Probe eine Lücke
    expect(tempo(analysisInput(asOnPrintout(raw), "decimal", LP_10M))).not.toBe(tempo(page(raw)))
  })

  it("eine späte Probe in der Pause vor Schuss 21: der Satz zur Pause bleibt", () => {
    const twenty = CARD.filter((s) => s.kind === "match")[19]
    const raw = withSighterAfter(CARD, 20, (twenty.firedAtMs as number) + 200_000)
    const pause = observations(page(raw)).find((s) => s.icon === "pause")
    expect(pause?.text).toMatch(/^Nach der Pause vor Schuss 21 lagen die Schüsse danach/)
  })
})

describe("Beobachtungen in Worten", () => {
  const sentences = observations(input)

  it("mindestens fünf Sätze, in fester Reihenfolge", () => {
    expect(sentences.length).toBeGreaterThanOrEqual(5)
    expect(sentences[0].icon).toBe("position")
    expect(sentences[0].text).toMatch(
      mpiConfidence(base)!.real
        ? /^Deine Gruppe liegt .* neben der Mitte, und das ist sicher kein Zufall\./
        : /das kann aber Zufall sein/
    )
    expect(sentences.map((s) => s.icon)).toContain("spread")
  })

  it("Lage echt: der Gewinn in der Mitte mit seinem n und je Schuss, ohne Visier", () => {
    // 2,8 Ringe sind die Summe über 40 Schuss, nicht der Gewinn eines Schusses
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

  it("ein Lage-Anteil unter null heißt „Lage kostet nichts“", () => {
    // die Gruppe um die Mitte geschoben: in die Mitte verschoben brächte sie rechnerisch nichts
    const centered = CARD.map((s) =>
      s.kind === "match" && s.xUm !== null && s.yUm !== null
        ? { ...s, xUm: s.xUm + 3500, yUm: s.yUm - 2200 }
        : s
    )
    const input = analysisInput(centered, "decimal", LP_10M)
    const split = ringLossSplit(input.base, LP_10M)!
    expect(split.positionLoss.decimal).toBeLessThan(0)
    const hint = overviewTiles(input).find((t) => t.label === "Ringverlust")!.hint
    // Lage und Streuung ergeben zusammen den Ringverlust: kostet die Lage nichts, trägt die Streuung alles
    expect(hint).toBe(
      `Lage kostet nichts · Streuung ${formatValue(split.total!.decimal, 1)} · Aufteilung unsicher`
    )
    // ohne belegten Versatz „passt“ die Lage, nicht „unklar“
    expect(mpiConfidence(input.base)!.real).toBe(false)
    const lage = overviewTiles(input).find((t) => t.label === "Lage")!
    expect([lage.value, lage.hint]).toEqual(["passt", "kein Versatz belegt"])
  })

  it("Lage nicht echt: kein Grund zum Verstellen, nur kein Beleg", () => {
    const centered = CARD.map((s) =>
      s.kind === "match" && s.xUm !== null && s.yUm !== null
        ? { ...s, xUm: s.xUm + 3500, yUm: s.yUm - 2200 }
        : s
    )
    const text = observations(analysisInput(centered, "decimal", LP_10M))[0].text
    expect(text).toMatch(
      /^Deine Gruppe liegt [\d,]+ mm neben der Mitte, das kann aber Zufall sein\. Ein Versatz ist nicht belegt\.$/
    )
  })

  it("ein Ausreißer: „Er kostet“, mehrere: „Sie kosten“", () => {
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

  it("eine späte Probe in der Pause vor Schuss 21 verdeckt sie nicht (SF-04)", () => {
    const twenty = CARD.filter((s) => s.kind === "match")[19]
    const late = withSighterAfter(CARD, 20, (twenty.firedAtMs as number) + 200_000)
    const pause = observations(analysisInput(late, "decimal", LP_10M)).find(
      (s) => s.icon === "pause"
    )
    expect(pause?.text).toMatch(/^Nach der Pause vor Schuss 21 lagen die Schüsse danach/)
  })

  it("Tempo-Satz über eine späte Probe mitten im Takt: keine Lücke (SF-04)", () => {
    const late = analysisInput(withSighterAfter(CARD, 7), "decimal", LP_10M)
    const pace = tempoSpread(late.base, late.card)!
    const median = formatValue(pace.medianMs / 1000, 0)
    expect(median).not.toBe(formatValue(tempoSpread(late.base)!.medianMs / 1000, 0))
    const clock = observations(late).find((s) => s.icon === "clock")!.text
    expect(clock).toContain(`Tempo: meist ${median} s je Schuss`)
  })

  it("die Pause vor Schuss 21: bis zu drei Schüsse danach, je Schuss gegen die übrigen", () => {
    // nicht „unter dem Schnitt der Scheibe“ und nicht „die nächsten drei“
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
    // Wertungsschüsse 21 bis 23 ohne Zehntel: die Pause bleibt, die Wirkung fehlt
    const blind = CARD.map((s, i) => (i >= 29 && i <= 31 ? { ...s, decimalTenths: null } : s))
    const pause = observations(analysisInput(blind, "decimal", LP_10M)).find(
      (s) => s.icon === "pause"
    )!.text
    expect(pause).toMatch(/^Nach der Pause vor Schuss 21 fehlen Werte zum Vergleich\./)
    expect(pause).not.toContain("NaN")
  })

  it("Ermüdung je Schuss und zusammen über zehn Schuss", () => {
    const tired = fatigue(base, "decimal")!
    const text = sentences.find((s) => s.icon === "trend")!.text
    expect(text).toContain(
      `Die letzten zehn Schuss lagen im Schnitt ${formatValue(Math.abs(tired.deltaRings), 2)} Ringe je Schuss ${tired.deltaRings < 0 ? "unter" : "über"} den ersten zehn (zusammen ${formatSigned(tired.deltaRings * 10, 1)} Ringe), die Gruppe ${formatValue(Math.abs(tired.deltaR50Um!) / 1000, 2)} mm ${tired.deltaR50Um! >= 0 ? "weiter" : "enger"}.`
    )
  })

  it("der Trend nennt den Wert je Schuss alle zehn Schuss und je Zehnerserie das Zehnfache", () => {
    const trend = cardTrend(base, "decimal")!
    const text = sentences.find((s) => s.icon === "trend")!.text
    // nicht „Ringe je zehn Schuss“: das las sich als Summe der Serie
    expect(text).not.toContain("je zehn Schuss")
    expect(text).toContain(
      trend.clear
        ? `um ${formatValue(Math.abs(trend.perTenShots), 2)} Ringe alle zehn Schuss, eine Zehnerserie um ${formatValue(Math.abs(trend.perTenShots * 10), 1)} Ringe`
        : `Wert je Schuss ${formatSigned(trend.perTenShots, 2)} Ringe alle zehn Schuss, je Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} Ringe`
    )
  })

  it("kein Satz zu Probe gegen Wertung (wie am Ausdruck)", () => {
    expect(sentences.map((s) => s.text).join(" ")).not.toMatch(/Probe/)
  })

  it("ein Ausreißer-freier Abend: die Kachel sagt „keiner“", () => {
    const calm = CARD.filter((s) => s.kind === "match").slice(0, 20)
    const input = analysisInput(calm, "decimal", LP_10M)
    expect(outliers(input.base)!.flagged).toHaveLength(0)
    const tile = overviewTiles(input).find((t) => t.label === "Ausreißer")!
    expect([tile.value, tile.hint]).toEqual(["keiner", "fällt aus der Gruppe"])
  })

  it("ohne drei Wertungsschüsse keine Sätze", () => {
    expect(observations(analysisInput(CARD.slice(9, 11), "decimal", LP_10M))).toEqual([])
  })
})
