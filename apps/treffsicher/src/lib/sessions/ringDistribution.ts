import { ringDistribution, type RingDistribution } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"

import { parseShotValue } from "@/lib/sessions/shots"

/**
 * Ringverteilung der Wertungsschüsse einer Einheit wie in Spiegel (`ringDistribution` aus dem Fachkern): je Schuss
 * der ganze Ring (bei Zehnteln abgerundet, 9,9 ist eine 9). Treffsicher kennt keine Lage je Schuss, also keine
 * Innenzehner; Schüsse ohne lesbaren Wert zählen nicht.
 */
export function sessionRingDistribution(shots: readonly string[]): RingDistribution {
  const metricShots = shots.flatMap((shot, i): MetricShot[] => {
    const value = parseShotValue(shot)
    if (value === null) return []
    return [
      {
        seq: i + 1,
        xUm: null,
        yUm: null,
        decimalTenths: Math.round(value * 10),
        ring: Math.floor(value),
        innerTen: false,
        firedAtMs: null,
        kind: "match",
        series: null,
      },
    ]
  })
  return ringDistribution(metricShots)
}
