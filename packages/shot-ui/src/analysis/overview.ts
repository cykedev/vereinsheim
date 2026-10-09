// Die acht Kacheln des Überblicks (Spielwiese `overviewTab`): je ein Wert aus dem Fachkern mit Einheit,
// einer kurzen Angabe und dem Hilfe-Thema; ohne Wert der Grund statt einer Zahl.

import {
  cardTrend,
  mpiConfidence,
  outliers,
  ringLossSplit,
  shareAtLeast,
  sigmaEstimate,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"

import { directionName, formatSigned, formatValue, percentText } from "../format"
import { meanWithCount, NO_CENTER, NO_FULL_POSITION, noResultReason, valuedWord } from "../reasons"
import type { AnalysisInput } from "./input"
import { shownRingLoss } from "./ringLoss"

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
  const { base, card, scoring, target } = input
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
  // Abstände über die ganze Karte: eine späte Probe ist keine Lücke (SF-04)
  const pace = tempoSpread(base, card)
  const tempoMedian = computeMetric(metricByKey("time.intervalMedian")!, base, card)
  const flagged = outliers(base)
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
      `${mean ? `Ø ${formatValue(mean.mean, 2)} je Schuss (${mean.n} ${valuedWord(scoring)}) · ` : ""}${noResultReason(base, scoring)}`
    ),
    tile(
      "Zehnerquote",
      "quoten",
      tens ? formatValue(tens.rate * 100, 0) : null,
      "%",
      tens
        ? `${tens.count} von ${tens.n} · sicher ${percentText(tens.low)} bis ${percentText(tens.high)}`
        : "",
      "ab 1 Schuss"
    ),
    tile(
      // Alltagswort auf der Kachel, σ im Blatt (U3, D3)
      "Streuung",
      "praezision-sigma",
      sigma ? mm2(sigma.sigma) : null,
      "mm",
      sigma ? `sicher ${mm2(sigma.low)} bis ${mm2(sigma.high)} mm` : "",
      "ab 3 Schuss"
    ),
    tile(
      "Lage",
      "lage-echt",
      // in Alltagsworten (U3, D11; User: „Lage unklar ist … schwer zu verstehen“): ohne belegten Versatz passt sie
      confidence ? (confidence.real ? "versetzt" : "passt") : null,
      "",
      // nur die Richtung: die Zahlen stehen in der Beobachtung, T² und Grenze im Blatt (U3, D3)
      confidence
        ? confidence.real
          ? directionName(confidence.center)
          : "kein Versatz belegt"
        : "",
      NO_CENTER
    ),
    tile(
      "Ringverlust",
      "ringverlust-nach-ursache",
      split?.total ? rings(split.total[key]) : null,
      "Ringe",
      // ein Lage-Anteil bis null ist kein Gewinn: Die Gruppe sitzt schon gut, die Streuung trägt dann den ganzen
      // Verlust (U3, D10 und Review; Grund im Reiter Lage)
      split
        ? (() => {
            const shown = shownRingLoss(split, key)
            const position = shown.position === null ? "kostet nichts" : rings(shown.position)
            return `Lage ${position} · Streuung ${rings(shown.spread)}${split.reliable ? "" : " · Aufteilung unsicher"}`
          })()
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
        ? `je Schuss alle 10 Schuss · Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)} Ringe · ${
            trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"}` : "nicht klar"
          }`
        : "",
      "ab 10 Schuss"
    ),
    tile(
      "Tempo",
      "tempo-und-dauer",
      // der Median wie im Reiter Zeit und an der Scheibe ab 3 Schuss mit Zeit, die Streuung ab 4 (Review)
      tempoMedian === null ? null : formatValue(tempoMedian, 0),
      "s",
      pace ? `die Hälfte in ${formatValue(pace.iqrMs / 1000, 0)} s` : "",
      "ab 3 Schuss mit Zeit"
    ),
    // U4, D6: statt „Eingeschossen?“ (Probe neben Wertung gibt es nicht mehr) die Ausreißer, wie viele und welche;
    // was sie kosten, steht einmal in der Beobachtung
    tile(
      "Ausreißer",
      "ausreisser",
      flagged ? String(flagged.flagged.length) : null,
      "",
      flagged
        ? flagged.flagged.length === 0
          ? "keiner fällt aus der Gruppe"
          : `${flagged.flagged.length === 1 ? "Schuss" : "Schüsse"} ${flagged.flagged.map((o) => o.number).join(", ")}`
        : "",
      "ab 5 Schuss mit Lage"
    ),
  ]
}
