// Plausible Serienwerte für den Prüfbestand und Paare mit vorgegebenem Ausgang. Ob ein Paar so ausgeht wie gewollt,
// entscheidet Ringwerks eigener Vergleich (`duelOutcome`), nicht eine Kopie davon.

import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { calculateRingteiler, MAX_RINGS } from "@/lib/results/calculateResult"
import { duelOutcome } from "@/lib/scoring/bestOf"

import type { Random } from "./random"

export interface SeriesValue {
  rings: number
  teiler: number
}

export type Winner = "A" | "B" | "TIE"

const round1 = (value: number) => Math.round(value * 10) / 10
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Eine Serie über `shots` Schuss: Ringe um 8,6 bis 9,7 je Schuss (Zehntel: 9,6 bis 10,5), je nach Stärke 0 bis 1;
 * Teiler als bester Schuss, kleiner bei Stärkeren.
 */
export function seriesValue(
  random: Random,
  scoringType: ScoringType,
  strength: number,
  shots = 10
): SeriesValue {
  const rings =
    scoringType === "DECIMAL"
      ? clamp(
          round1(random.normal(shots * (9.6 + 0.9 * strength), shots * 0.3)),
          shots * 7,
          shots * 10.9
        )
      : clamp(
          Math.round(random.normal(shots * (8.6 + 1.1 * strength), shots * 0.25)),
          shots * 6,
          shots * 10
        )
  const meanTeiler = 140 - 110 * strength
  const teiler = clamp(round1(-meanTeiler * Math.log(1 - random.next())), 0.3, 999.9)
  return { rings, teiler }
}

/** Ein Paar Serien, das unter `mode` mit `winner` ausgeht; bei „TIE“ zweimal dieselbe Serie. */
export function forcedPair(
  random: Random,
  scoringType: ScoringType,
  mode: ScoringMode,
  winner: Winner,
  shots = 10
): [SeriesValue, SeriesValue] {
  const a = seriesValue(random, scoringType, 0.6, shots)
  if (winner === "TIE") return [a, { ...a }]
  let b = seriesValue(random, scoringType, 0.6, shots)
  const maxRings = MAX_RINGS[scoringType]
  // Fester Disziplin-Faktor 1 (fester Wettbewerb); für diese Modi entscheidet duelOutcome wie determineOutcome.
  const decide = (x: SeriesValue, y: SeriesValue): Winner =>
    duelOutcome(
      {
        rings: x.rings,
        correctedTeiler: x.teiler,
        ringteiler: calculateRingteiler(x.rings, x.teiler, 1, maxRings),
      },
      {
        rings: y.rings,
        correctedTeiler: y.teiler,
        ringteiler: calculateRingteiler(y.rings, y.teiler, 1, maxRings),
      },
      mode,
      null,
      null
    )
  while (decide(a, b) === "TIE") b = seriesValue(random, scoringType, 0.6, shots)
  return decide(a, b) === winner ? [a, b] : [b, a]
}

/** Ringe als Eingabe wie in der Oberfläche: ganze Zahl oder mit Komma. */
export function ringsText(rings: number, scoringType: ScoringType): string {
  return scoringType === "DECIMAL" ? rings.toFixed(1).replace(".", ",") : String(rings)
}

export function teilerText(teiler: number): string {
  return teiler.toFixed(1).replace(".", ",")
}
