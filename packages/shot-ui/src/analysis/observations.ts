// Beobachtungen in Worten: die wichtigsten Befunde als Sätze, gebildet aus denselben Zahlen wie die Karten, in fester
// Reihenfolge. Ein Satz steht nur, wenn der Fachkern einen Wert hat; „sicher“ und „klar“ nur, wenn sein Test es sagt
// (in Alltagsworten).

import {
  cardTrend,
  fatigue,
  mpiConfidence,
  outlierLoss,
  outliers,
  pauseRecovery,
  ringLossSplit,
  sigmaEstimate,
  ringWidths,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import { directionWords, formatSigned, formatValue, ringsSigned, ringsText } from "../format"
import type { AnalysisInput } from "./input"

export type ObservationIcon = "position" | "spread" | "outlier" | "trend" | "pause" | "clock"

export interface Observation {
  icon: ObservationIcon
  text: string
  /**
   * fällt auf und gehört in den Kopf der Seite: die Lage immer, Ausreißer nur wenn es welche gibt, Trend und
   * Ermüdung nur wenn sie klar sind, Pausen nur wenn eine klar ist; Präzision und Tempo nie. Probe gegen Wertung gibt
   * es nicht
   */
  notable: boolean
  /**
   * was im Kopf steht, wenn nicht der erste Satz das Auffällige sagt (eine klare Ermüdung ohne klaren Trend, eine
   * klare Pause)
   */
  headline?: string
}

/** der erste Satz: bis zum Punkt, auf den ein Leerzeichen und ein Großbuchstabe folgen (ein Komma in Zahlen trennt nicht) */
export function firstSentence(text: string): string {
  return text.split(/(?<=\.) (?=[A-ZÄÖÜ])/)[0]
}

/**
 * Die wichtigsten Beobachtungen für den Kopf der Seite: die Lage zuerst, dann die auffälligen in ihrer
 * Reihenfolge, höchstens `max`, je ihr erster Satz oder ihre `headline`. Ohne Lage nur die auffälligen,
 * ohne beides keine.
 */
export function keyObservations(list: readonly Observation[], max = 3): Observation[] {
  const position = list.find((o) => o.icon === "position")
  const rest = list.filter((o) => o.icon !== "position" && o.notable)
  return [...(position ? [position] : []), ...rest]
    .slice(0, max)
    .map((o) => ({ ...o, text: o.headline ?? firstSentence(o.text) }))
}

export function observations(input: AnalysisInput): Observation[] {
  const { base, card, scoring, target } = input
  const out: Observation[] = []
  const mm = (um: number) => `${formatValue(um / 1000, 2)} mm`

  const confidence = mpiConfidence(base)
  if (confidence) {
    if (confidence.real) {
      // Alltagsworte: „Gruppe“ statt „Schwerpunkt“, „sicher“ statt „mit 95 %“; die Fachbegriffe im Blatt
      let text = `Deine Gruppe liegt ${directionWords(confidence.center)} neben der Mitte, und das ist sicher kein Zufall.`
      const split = ringLossSplit(base, target)
      if (split?.reliable) {
        // die Summe über alle Schüsse mit Lage, darum mit ihrem n und je Schuss
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
        text: `Deine Gruppe liegt ${mm(Math.hypot(confidence.center.xUm, confidence.center.yUm))} neben der Mitte, das kann aber Zufall sein. Ein Versatz ist nicht belegt.`,
      })
    }
  }

  const sigma = sigmaEstimate(base)
  if (sigma) {
    const r50 = computeMetric(inScoring(metricByKey("group.r50")!, scoring), base)
    out.push({
      icon: "spread",
      notable: false,
      text: `Streuung ${formatValue(sigma.sigma / 1000, 2)} mm, sicher zwischen ${formatValue(sigma.low / 1000, 2)} und ${formatValue(sigma.high / 1000, 2)} mm.${
        r50 === null
          ? ""
          : ` Die Hälfte der Treffer liegt innerhalb von ${formatValue(ringWidths(r50 * 1000, target), 2)} Ringbreiten um die Mitte der Gruppe.`
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
    let fatigueText = ""
    if (tired) {
      // der Unterschied gilt je Schuss; zehn Schuss zusammen das Zehnfache
      const d = tired.deltaRings
      const where =
        Math.abs(d) < 0.005
          ? "genau im Schnitt der ersten zehn"
          : `im Schnitt ${formatValue(Math.abs(d), 2)} Ringe je Schuss ${d < 0 ? "unter" : "über"} den ersten zehn (zusammen ${ringsSigned(d * 10, scoring === "rings" ? 0 : 1)})`
      // „die Gruppe weiter/enger“ statt „R50 ±…“
      const group =
        tired.deltaR50Um === null
          ? ""
          : `, die Gruppe ${formatValue(Math.abs(tired.deltaR50Um) / 1000, 2)} mm ${tired.deltaR50Um >= 0 ? "weiter" : "enger"}`
      // das Urteil gilt für den Wert, nicht für die Gruppe; genau im Schnitt braucht keins
      const verdict =
        tired.direction === "down"
          ? " Am Ende hast du klar nachgelassen."
          : tired.direction === "up"
            ? " Am Ende bist du klar stärker geworden."
            : Math.abs(d) < 0.005
              ? ""
              : " Der Unterschied kann Zufall sein."
      fatigueText = `Die letzten zehn Schuss lagen ${where}${group}.${verdict}`
      text += ` ${fatigueText}`
    }
    // fällt nur die Ermüdung auf, steht im Kopf ihr Satz, nicht der erste Satz zum Trend
    const headline = !trend.clear && tired?.clear ? fatigueText : undefined
    out.push({
      icon: "trend",
      text,
      notable: trend.clear || tired?.clear === true,
      ...(headline ? { headline } : {}),
    })
  }

  const recovery = pauseRecovery(base, scoring, card)
  if (recovery?.effects.length) {
    // gegen die übrigen Schüsse und je Schuss, bis zu drei danach; ohne vergleichbaren Wert sagt der Satz das,
    // statt „im Schnitt“
    // je Pause ein Satz, danach ihr Urteil; was als „genau im Schnitt“ erscheint, braucht keins
    const sentences = recovery.effects.map(({ afterShot, deltaRings: d, direction }) => {
      if (d === null) return `Nach der Pause vor Schuss ${afterShot} fehlen Werte zum Vergleich.`
      const even = Math.abs(d) < 0.005
      const where = even
        ? "genau im Schnitt deiner übrigen Schüsse"
        : `im Schnitt ${formatValue(Math.abs(d), 2)} Ringe je Schuss ${d < 0 ? "unter" : "über"} deinen übrigen Schüssen`
      const verdict =
        direction === "up"
          ? " Danach warst du klar stärker."
          : direction === "down"
            ? " Danach warst du klar schwächer."
            : even
              ? ""
              : " Das kann Zufall sein."
      return `Nach der Pause vor Schuss ${afterShot} lagen die Schüsse danach (bis zu drei) ${where}.${verdict}`
    })
    // fällt eine Pause auf, steht im Kopf ihr Satz, nicht der der ersten Pause
    const clearAt = recovery.effects.findIndex((e) => e.clear)
    out.push({
      icon: "pause",
      notable: clearAt >= 0,
      text: sentences.join(" "),
      ...(clearAt >= 0 ? { headline: sentences[clearAt] } : {}),
    })
  }

  const pace = tempoSpread(base, card)
  if (pace) {
    out.push({
      icon: "clock",
      notable: false,
      text: `Tempo: meist ${formatValue(pace.medianMs / 1000, 0)} s je Schuss. Die Hälfte der Abstände liegt in einem Fenster von ${formatValue(pace.iqrMs / 1000, 0)} s.`,
    })
  }

  return out
}
