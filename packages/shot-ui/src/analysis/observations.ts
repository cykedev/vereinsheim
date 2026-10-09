// Beobachtungen in Worten (Spielwiese `observations`): die wichtigsten Befunde als Sätze, gebildet aus
// denselben Zahlen wie die Karten, in fester Reihenfolge. Ein Satz steht nur, wenn der Fachkern einen Wert
// hat; „echt“ und „klar“ nur, wenn sein Test es sagt.

import {
  cardTrend,
  fatigue,
  mpiConfidence,
  outlierLoss,
  outliers,
  pauseRecovery,
  ringLossSplit,
  sighterComparison,
  sighterZeroed,
  sigmaEstimate,
  ringWidths,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import {
  countWord,
  directionName,
  directionWords,
  formatSigned,
  formatValue,
  ringsSigned,
  ringsText,
} from "../format"
import type { AnalysisInput } from "./input"

export type ObservationIcon =
  | "position"
  | "spread"
  | "outlier"
  | "trend"
  | "pause"
  | "clock"
  | "flag"

export interface Observation {
  icon: ObservationIcon
  text: string
  /**
   * fällt auf und gehört in den Kopf der Seite (U1, D4): die Lage immer, Ausreißer nur wenn es welche gibt, ein Trend
   * nur wenn er klar ist, die Probe nur wenn sie echt neben der Mitte lag; Präzision, Pausen und Tempo nie
   */
  notable: boolean
  /**
   * der Satz für den Kopf, wenn das Auffällige nicht im ersten Satz steht (die Probe: erst der Vergleich der Mittel,
   * dann der Versatz; Review U1); sonst gilt der erste Satz
   */
  head?: string
}

/** der erste Satz: bis zum Punkt, auf den ein Leerzeichen und ein Großbuchstabe folgen (ein Komma in Zahlen trennt nicht) */
export function firstSentence(text: string): string {
  return text.split(/(?<=\.) (?=[A-ZÄÖÜ])/)[0]
}

/**
 * Die wichtigsten Beobachtungen für den Kopf der Seite (U1, D4): die Lage zuerst, dann die auffälligen in ihrer
 * Reihenfolge, höchstens `max`, je ihr Satz für den Kopf (`head`, sonst der erste). Ohne Lage nur die auffälligen,
 * ohne beides keine.
 */
export function keyObservations(list: readonly Observation[], max = 3): Observation[] {
  const position = list.find((o) => o.icon === "position")
  const rest = list.filter((o) => o.icon !== "position" && o.notable)
  return [...(position ? [position] : []), ...rest]
    .slice(0, max)
    .map((o) => ({ ...o, text: o.head ?? firstSentence(o.text) }))
}

export function observations(input: AnalysisInput): Observation[] {
  const { all, base, card, scoring, target } = input
  const out: Observation[] = []
  const rings = (v: number) => formatValue(v, scoring === "rings" ? 0 : 1)
  const mm = (um: number) => `${formatValue(um / 1000, 2)} mm`

  const confidence = mpiConfidence(base)
  if (confidence) {
    if (confidence.real) {
      let text = `Die Lage ist echt: Der Schwerpunkt liegt ${directionWords(confidence.center)} neben der Mitte, mit 95 % kein Zufall.`
      const split = ringLossSplit(base, target)
      if (split?.reliable) {
        // die Summe über alle Schüsse mit Lage, darum mit ihrem n und je Schuss (Prüfung, Ergebnis 1)
        const gain = split.positionLoss[scoring === "rings" ? "rings" : "decimal"]
        text +=
          gain > 0
            ? ` Läge die Gruppe in der Mitte, brächten ${split.n} weitere Schuss zusammen etwa ${ringsText(gain, scoring === "rings" ? 0 : 1)} mehr (rund ${formatValue(gain / split.n, 2)} je Schuss).`
            : " In der Mitte brächte die Gruppe keine Ringe mehr."
      }
      out.push({ icon: "position", text, notable: true })
    } else {
      out.push({
        icon: "position",
        notable: true,
        text: `Der Schwerpunkt liegt ${mm(Math.hypot(confidence.center.xUm, confidence.center.yUm))} neben der Mitte; vom Zufall ist das nicht zu unterscheiden. Ein Versatz ist nicht belegt.`,
      })
    }
  }

  const sigma = sigmaEstimate(base)
  if (sigma) {
    const r50 = computeMetric(inScoring(metricByKey("group.r50")!, scoring), base)
    out.push({
      icon: "spread",
      notable: false,
      text: `Präzision σ ${formatValue(sigma.sigma / 1000, 2)} mm, mit 95 % zwischen ${formatValue(sigma.low / 1000, 2)} und ${formatValue(sigma.high / 1000, 2)} mm.${
        r50 === null
          ? ""
          : ` Die Hälfte der Treffer liegt innerhalb von ${formatValue(ringWidths(r50 * 1000, target), 2)} Ringbreiten um den Schwerpunkt.`
      }`,
    })
  }

  const flagged = outliers(base)
  if (flagged) {
    const loss = outlierLoss(base, scoring)
    const numbers = flagged.flagged.map((o) => o.number)
    const one = numbers.length === 1
    const ringsOf = (v: number) => ringsText(v, scoring === "rings" ? 0 : 1)
    const lossText =
      !loss || !loss.count
        ? ""
        : loss.loss >= 0
          ? ` ${one ? "Er kostet" : "Sie kosten"} ${ringsOf(loss.loss)} gegen deinen typischen Schuss.`
          : ` ${one ? "Er bringt" : "Sie bringen"} ${ringsOf(-loss.loss)} mehr als dein typischer Schuss, weil ${one ? "er" : "sie"} zur Mitte hin ${one ? "liegt" : "liegen"}.`
    out.push({
      icon: "outlier",
      notable: numbers.length > 0,
      text: numbers.length
        ? `${numbers.length === 1 ? `Schuss ${numbers[0]} fällt` : `Die Schüsse ${numbers.join(", ")} fallen`} als Ausreißer aus der Gruppe.${lossText}`
        : `Keine Ausreißer.${lossText}`,
    })
  }

  const trend = cardTrend(base, scoring)
  if (trend) {
    // die Steigung gilt für den Wert je Schuss, über zehn Schuss: nicht je Schuss, nicht für die Summe der Serie
    // eine Zehnerserie ändert sich um das Zehnfache: so lässt sich die Zahl an den Serienergebnissen prüfen
    const perSeries = formatSigned(trend.perTenShots * 10, 1)
    let text = trend.clear
      ? `Über die Scheibe klar ${trend.direction === "up" ? "steigend" : "fallend"}: Der Wert je Schuss ${trend.direction === "up" ? "steigt" : "sinkt"} um ${formatValue(Math.abs(trend.perTenShots), 2)} Ringe alle zehn Schuss, eine Zehnerserie um ${formatValue(Math.abs(trend.perTenShots * 10), 1)} Ringe.`
      : `Kein klarer Trend über die Scheibe (Wert je Schuss ${formatSigned(trend.perTenShots, 2)} Ringe alle zehn Schuss, je Zehnerserie ${perSeries} Ringe).`
    const tired = fatigue(base, scoring)
    if (tired) {
      // der Unterschied gilt je Schuss; zehn Schuss zusammen das Zehnfache (Prüfung, Zeit 4)
      const d = tired.deltaRings
      const where =
        Math.abs(d) < 0.005
          ? "genau im Schnitt der ersten zehn"
          : `im Schnitt ${formatValue(Math.abs(d), 2)} Ringe je Schuss ${d < 0 ? "unter" : "über"} den ersten zehn (zusammen ${ringsSigned(d * 10, scoring === "rings" ? 0 : 1)})`
      text += ` Die letzten zehn Schuss lagen ${where}${
        tired.deltaR50Um !== null ? `, R50 ${formatSigned(tired.deltaR50Um / 1000, 2)} mm` : ""
      }. Ein Muster zeigt erst der Vergleich über mehrere Scheiben.`
    }
    out.push({ icon: "trend", text, notable: trend.clear })
  }

  const recovery = pauseRecovery(base, scoring, card)
  if (recovery?.effects.length) {
    // gegen die übrigen Schüsse und je Schuss, bis zu drei danach (Prüfung, Zeit 1); ohne vergleichbaren
    // Wert sagt der Satz das, statt „im Schnitt“ (Plan D8)
    const effect = (afterShot: number, d: number | null) =>
      d === null
        ? `nach der Pause vor Schuss ${afterShot} fehlen Werte zum Vergleich`
        : `nach der Pause vor Schuss ${afterShot} lagen die Schüsse danach (bis zu drei) ${
            Math.abs(d) < 0.005
              ? "genau im Schnitt deiner übrigen Schüsse"
              : `im Schnitt ${formatValue(Math.abs(d), 2)} Ringe je Schuss ${d < 0 ? "unter" : "über"} deinen übrigen Schüssen`
          }`
    const text = recovery.effects.map((e) => effect(e.afterShot, e.deltaRings)).join("; ")
    out.push({
      icon: "pause",
      notable: false,
      text: `${text[0].toUpperCase()}${text.slice(1)}. Drei Schuss sind wenig; ein Urteil braucht mehrere Abende.`,
    })
  }

  const pace = tempoSpread(base, card)
  if (pace) {
    out.push({
      icon: "clock",
      notable: false,
      text: `Tempo: im Median ${formatValue(pace.medianMs / 1000, 0)} s je Schuss; die mittlere Hälfte der Abstände liegt in einem Fenster von ${formatValue(pace.iqrMs / 1000, 0)} s.`,
    })
  }

  const comparison = sighterComparison(all, scoring)
  if (comparison && comparison.probe.meanRings !== null && comparison.match.meanRings !== null) {
    let text = `Probe: Ø ${formatValue(comparison.probe.meanRings, 2)} je Schuss gegen ${formatValue(comparison.match.meanRings, 2)} in der Wertung.`
    const zeroed = sighterZeroed(all)
    // auffällig ist an der Probe der echte Versatz: Er steht im Kopf, nicht der Vergleich der Mittel (Review U1)
    let head: string | undefined
    if (zeroed) {
      // nur, was der Test über die Probe sagt, nichts über die Wertung; mit ihrem n (Prüfung, Probe 1 und 5)
      const last = countWord(zeroed.n)
      if (zeroed.real)
        head = `Die letzten ${last} Probeschüsse lagen echt neben der Mitte (${directionName(zeroed.center)}, ${mm(zeroed.offsetUm)}).`
      text += head
        ? ` ${head}`
        : ` Bei den letzten ${last} Probeschüssen ist kein Versatz nachweisbar.`
    }
    out.push({ icon: "flag", text, notable: zeroed?.real === true, ...(head ? { head } : {}) })
  }

  return out
}
