// Scheibenbilder als Daten.
//
// Ein Scheibenbild wird in mm notiert, so wie die Sportordnung es angibt, und von `defineTarget` in
// ganze µm umgerechnet. Die Ringe haben gleiche Abstände: Ø(n) = Ø10 + 2 · Ringabstand · (10 − n).
// `defineTarget` prüft, dass jede Zehntelgrenze auf einem ganzen µm liegt; nur dann rechnet die
// Wertung in scoring.ts exakt.
//
// Quelle der Maße: DSB-Sportordnung 2026, Teil 0, Anhang 0.20 (gleich ISSF 2026, 6.3).

import { mmToUm } from "./units"

export type TargetId = "lg-10m" | "lp-10m"
export type Weapon = "lg" | "lp"

/** LP: Der Schuss berührt den Innenzehner. LG: Er schießt den Zehnerpunkt ganz weg. */
export type InnerTenRule =
  { kind: "touch"; diameterMm: number } | { kind: "shotOut"; diameterMm: number }

export interface TargetSpec {
  id: TargetId
  version: number
  label: string
  weapon: Weapon
  tenDiameterMm: number
  ringWidthMm: number
  /** Spiegel (schwarz) */
  blackDiameterMm: number
  caliberMm: number
  innerTen: InnerTenRule
  labelRings: readonly number[]
}

export interface TargetImage extends TargetSpec {
  /** Außenradius je Ring, Index 0 = Ring 1 … Index 9 = Ring 10, in µm */
  ringRadiiUm: readonly number[]
  ringWidthUm: number
  caliberUm: number
  /**
   * R = Zehnerradius + halbes Kaliber: Nach der Regel zählt ein Schuss bis zu diesem Abstand 10,0;
   * Meyton wertet bis knapp R + MEYTON_TOLERANCE_UM (scoring.ts).
   */
  scoringRadiusUm: number
  innerTenMaxDistanceUm: number
  /** Ring, an dem der Spiegel endet (LG 4, LP 7) */
  blackFromRing: number
}

/** 10,9 in Zehnteln: höher wertet Meyton nicht. */
export const MAX_DECIMAL_TENTHS = 109

function requireWholePositive(value: number, what: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${what} muss ein ganzes, positives µm sein, ist ${value}`)
  }
  return value
}

export function defineTarget(spec: TargetSpec): TargetImage {
  const tenRadiusUm = requireWholePositive(mmToUm(spec.tenDiameterMm) / 2, "Zehnerradius")
  const ringWidthUm = requireWholePositive(mmToUm(spec.ringWidthMm), "Ringabstand")
  const caliberUm = mmToUm(spec.caliberMm)
  const halfCaliberUm = requireWholePositive(caliberUm / 2, "halbes Kaliber")
  if (ringWidthUm % 10 !== 0) {
    throw new RangeError(`Ein Zehntel des Ringabstands (${ringWidthUm} µm) ist kein ganzes µm`)
  }

  const ringRadiiUm = Array.from({ length: 10 }, (_, i) => tenRadiusUm + (9 - i) * ringWidthUm)

  const innerRadiusUm = mmToUm(spec.innerTen.diameterMm) / 2
  const innerTenMaxDistanceUm = requireWholePositive(
    spec.innerTen.kind === "touch" ? innerRadiusUm + halfCaliberUm : halfCaliberUm - innerRadiusUm,
    "Innenzehner-Grenze"
  )
  const scoringRadiusUm = tenRadiusUm + halfCaliberUm
  if (innerTenMaxDistanceUm > scoringRadiusUm) {
    throw new RangeError("Der Innenzehner reicht über die Zehn hinaus")
  }

  const blackDiameterUm = mmToUm(spec.blackDiameterMm)
  const blackIndex = ringRadiiUm.findIndex((radius) => radius * 2 === blackDiameterUm)
  if (blackIndex < 0) {
    throw new RangeError(`Der Spiegel (${spec.blackDiameterMm} mm) endet auf keinem Ring`)
  }

  return Object.freeze({
    ...spec,
    innerTen: Object.freeze({ ...spec.innerTen }),
    labelRings: Object.freeze([...spec.labelRings]),
    ringRadiiUm: Object.freeze(ringRadiiUm),
    ringWidthUm,
    caliberUm,
    scoringRadiusUm,
    innerTenMaxDistanceUm,
    blackFromRing: blackIndex + 1,
  })
}

export const LG_10M = defineTarget({
  id: "lg-10m",
  version: 1,
  label: "Luftgewehr 10 m",
  weapon: "lg",
  tenDiameterMm: 0.5,
  ringWidthMm: 2.5,
  blackDiameterMm: 30.5,
  caliberMm: 4.5,
  innerTen: { kind: "shotOut", diameterMm: 0.5 },
  labelRings: [1, 2, 3, 4, 5, 6, 7, 8],
})

export const LP_10M = defineTarget({
  id: "lp-10m",
  version: 1,
  label: "Luftpistole 10 m",
  weapon: "lp",
  tenDiameterMm: 11.5,
  ringWidthMm: 8,
  blackDiameterMm: 59.5,
  caliberMm: 4.5,
  innerTen: { kind: "touch", diameterMm: 5 },
  labelRings: [1, 2, 3, 4, 5, 6, 7, 8],
})

export const TARGETS: Readonly<Record<TargetId, TargetImage>> = Object.freeze({
  "lg-10m": LG_10M,
  "lp-10m": LP_10M,
})
