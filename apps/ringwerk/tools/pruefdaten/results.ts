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

/** Ligen, deren Fall nicht vom Zufall abhängen darf. */
export type FixedCase = "teiler-roh-anders" | "ringe-gegen-ringteiler"

/**
 * Gemischt, Wertung nach Teiler: gerade Plätze schießen Luftgewehr (Faktor 1,0), ungerade Luftpistole (0,333). Jeder
 * schießt immer dieselbe Serie. Nach dem Teiler vom Ausdruck führt Platz 0 (35,0), korrigiert Platz 1 (90 × 0,333 ≈
 * 30,0); ebenso trennen sich Platz 3 (180 ≈ 60,0) und Platz 4 (70,0) je nach Teiler anders.
 */
const TEILER_ROH_ANDERS: SeriesValue[] = [
  { rings: 95, teiler: 35 },
  { rings: 95, teiler: 90 },
  { rings: 95, teiler: 50 },
  { rings: 95, teiler: 180 },
  { rings: 95, teiler: 70 },
  { rings: 95, teiler: 240 },
]

/**
 * Wertung nach Ringen: Platz 2 und 3 schlagen 4 und 5, verlieren gegen 0 und 1 und schießen gegeneinander zweimal
 * dieselbe Serie. Sie stehen gleich in Punkten und Direktpunkten. Die meisten Ringe hat Platz 2 (97 gegen 4 in der
 * Hinrunde), den besten Ringteiler Platz 3 (96 Ringe, Teiler 5,0 gegen 4 in der Hinrunde).
 */
const RINGE_GEGEN_RINGTEILER: SeriesValue[] = [
  { rings: 99, teiler: 20 },
  { rings: 98, teiler: 25 },
  { rings: 95, teiler: 40 },
  { rings: 95, teiler: 40 },
  { rings: 90, teiler: 60 },
  { rings: 88, teiler: 70 },
]

/** Serie eines Teilnehmers (Platz in der Einschreibung) gegen einen anderen in einer Liga mit festem Fall. */
export function fixedSeries(
  fixedCase: FixedCase,
  self: number,
  opponent: number,
  firstLeg: boolean
): SeriesValue {
  if (fixedCase === "teiler-roh-anders") return TEILER_ROH_ANDERS[self]
  if (firstLeg && opponent === 4 && self === 2) return { rings: 97, teiler: 80 }
  if (firstLeg && opponent === 4 && self === 3) return { rings: 96, teiler: 5 }
  return RINGE_GEGEN_RINGTEILER[self]
}
