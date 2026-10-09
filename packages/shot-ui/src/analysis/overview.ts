// Die acht Kacheln des Überblicks (Spielwiese `overviewTab`): je ein Wert aus dem Fachkern mit Einheit,
// einer kurzen Angabe und dem Hilfe-Thema; ohne Wert der Grund statt einer Zahl.

import {
  cardTrend,
  mpiConfidence,
  ringLossSplit,
  shareAtLeast,
  sighterZeroed,
  sigmaEstimate,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import { directionWords, formatSigned, formatValue, percentText } from "../format"
import { meanWithCount, NO_FULL_POSITION, noResultReason } from "../reasons"
import type { AnalysisInput } from "./input"

export interface OverviewTile {
  label: string
  /** formatierter Wert; null: kein Wert, die Angabe nennt den Grund */
  value: string | null
  unit: string
  hint: string
  /** Hilfe-Thema in `shot-help` */
  help: string
}

const tile = (
  label: string,
  help: string,
  value: string | null,
  unit: string,
  hint: string,
  missing: string
): OverviewTile => ({
  label,
  help,
  value,
  unit: value === null ? "" : unit,
  hint: value === null ? missing : hint,
})

export function overviewTiles(input: AnalysisInput): OverviewTile[] {
  const { all, base, scoring, target } = input
  const digits = scoring === "rings" ? 0 : 1
  const rings = (v: number) => formatValue(v, digits)
  const metric = (key: string) => computeMetric(inScoring(metricByKey(key)!, scoring), base)
  const total = metric("result.decimal")
  const mean = meanWithCount(base, scoring)
  const tens = shareAtLeast(base, scoring, 100)
  const sigma = sigmaEstimate(base)
  const confidence = mpiConfidence(base)
  const split = ringLossSplit(base, target)
  const trend = cardTrend(base, scoring)
  const pace = tempoSpread(base)
  const zeroed = sighterZeroed(all)
  const key = scoring === "rings" ? "rings" : "decimal"
  const mm2 = (um: number) => formatValue(um / 1000, 2)

  return [
    tile(
      "Ergebnis",
      "ergebnis",
      total === null ? null : rings(total),
      "Ringe",
      `Ø ${mean === null ? "–" : formatValue(mean.mean, 2)} je Schuss · ${base.length} Schuss`,
      // ohne Ergebnis den Ø über die Schüsse mit Wert, wie die Hilfe sagt (Prüfung, Ergebnis 3)
      `${mean ? `Ø ${formatValue(mean.mean, 2)} je Schuss (${mean.n} mit Wert) · ` : ""}${noResultReason(base, scoring)}`
    ),
    tile(
      "Zehnerquote",
      "quoten",
      tens ? formatValue(tens.rate * 100, 0) : null,
      "%",
      tens
        ? `${tens.count} von ${tens.n} · 95 %: ${percentText(tens.low)} bis ${percentText(tens.high)}`
        : "",
      "ab 1 Schuss"
    ),
    tile(
      "Präzision σ",
      "praezision-sigma",
      sigma ? mm2(sigma.sigma) : null,
      "mm",
      sigma ? `95 %: ${mm2(sigma.low)} bis ${mm2(sigma.high)} mm` : "",
      "ab 3 Schuss"
    ),
    tile(
      "Lage",
      "lage-echt",
      confidence ? (confidence.real ? "echt" : "unklar") : null,
      "",
      confidence
        ? `${directionWords(confidence.center)} · T² ${formatValue(confidence.t2, 1)}, Grenze ${formatValue(confidence.critical, 1)}`
        : "",
      "ab 3 Schuss"
    ),
    tile(
      "Ringverlust",
      "ringverlust-nach-ursache",
      split?.total ? rings(split.total[key]) : null,
      "Ringe",
      split
        ? `Lage ${rings(split.positionLoss[key])} · Streuung ${rings(split.spreadLoss[key])}${split.reliable ? "" : " · Aufteilung unsicher"}`
        : "",
      split ? NO_FULL_POSITION : "ab 2 Schuss mit Lage"
    ),
    tile(
      "Trend",
      "verlauf-und-trend",
      trend ? formatSigned(trend.perTenShots, 2) : null,
      // der Wert je Schuss, über zehn Schuss; die Serie ändert sich um das Zehnfache (Prüfung, Zeit 3)
      "Ringe",
      trend
        ? `je Schuss alle 10 Schuss · Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} · ${
            trend.clear
              ? `klar ${trend.direction === "up" ? "steigend" : "fallend"} (95 %)`
              : "nicht klar"
          }`
        : "",
      "ab 10 Schuss"
    ),
    tile(
      "Tempo",
      "tempo-und-dauer",
      pace ? formatValue(pace.medianMs / 1000, 0) : null,
      "s",
      pace ? `Median · mittlere Hälfte in ${formatValue(pace.iqrMs / 1000, 0)} s` : "",
      "ab 4 Schuss mit Zeit"
    ),
    // D3 (User, 9. Oktober 2026): das Urteil statt des Abstands Probe → Wertung, der auch ohne jede
    // Verschiebung bei etwa einem halben σ liegt (B21); die Zahl steht im Reiter Probe mit diesem Hinweis.
    // Ein Training nur aus Probe ist kein Einschießen (Prüfung, Probe 6).
    tile(
      "Eingeschossen?",
      "eingeschossen",
      input.basis === "nur Probe" || !zeroed ? null : zeroed.real ? "versetzt" : "unklar",
      "",
      zeroed
        ? `${zeroed.real ? "echt neben der Mitte" : "kein Versatz nachweisbar"} · letzte ${zeroed.n} Probeschüsse`
        : "",
      input.basis === "nur Probe"
        ? "Training nur mit Probe"
        : "ab 3 Probeschüssen mit Lage vor der Wertung"
    ),
  ]
}
