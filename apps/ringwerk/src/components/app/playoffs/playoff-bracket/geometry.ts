import type { PlayoffBracketData, PlayoffMatchItem } from "@/lib/playoffs/types"
import { INNER_GAP, OUTER_GAP, SLOT_H, type ConnectorPair, type SlotPreview } from "./constants"

/** Gibt den Siegernamen eines abgeschlossenen Matches zurück, sonst undefined. */
export function getWinnerName(match: PlayoffMatchItem | undefined): string | undefined {
  if (!match || match.status !== "COMPLETED") return undefined
  if (match.winsA > match.winsB)
    return `${match.participantA.firstName} ${match.participantA.lastName}`
  if (match.winsB > match.winsA)
    return `${match.participantB.firstName} ${match.participantB.lastName}`
  return undefined
}

/**
 * Berechnet die Y-Mittelpunkte eines Slots-Arrays.
 * tops[i] ist die obere Kante, Mittelpunkt = tops[i] + SLOT_H/2.
 */
function mids(tops: number[]): number[] {
  return tops.map((t) => t + SLOT_H / 2)
}

/**
 * Berechnet den zentrierten Top-Wert zwischen zwei Y-Mittelpunkten.
 * center = (mid1 + mid2) / 2 → top = center - SLOT_H/2
 */
function centeredTop(mid1: number, mid2: number): number {
  return (mid1 + mid2) / 2 - SLOT_H / 2
}

export interface BracketLayout {
  totalH: number
  afTops: number[]
  qfTops: number[]
  hfTops: number[]
  finalTop: number
  afQfPairs: ConnectorPair[]
  qfHfPairs: ConnectorPair[]
  hfFinalPairs: ConnectorPair[]
}

// Berechnet Slot-Positionen und Connector-Pairs je nach Bracket-Struktur (AF / VF / HF-only).
export function computeBracketLayout(isAF: boolean, isVF: boolean): BracketLayout {
  const half = SLOT_H / 2

  if (isAF) {
    const afTops = [
      0,
      SLOT_H + INNER_GAP,
      2 * SLOT_H + INNER_GAP + OUTER_GAP,
      3 * SLOT_H + 2 * INNER_GAP + OUTER_GAP,
      4 * SLOT_H + 2 * INNER_GAP + 2 * OUTER_GAP,
      5 * SLOT_H + 3 * INNER_GAP + 2 * OUTER_GAP,
      6 * SLOT_H + 3 * INNER_GAP + 3 * OUTER_GAP,
      7 * SLOT_H + 4 * INNER_GAP + 3 * OUTER_GAP,
    ]
    const totalH = 8 * SLOT_H + 4 * INNER_GAP + 3 * OUTER_GAP

    const afM = mids(afTops)
    const qfTops = [
      centeredTop(afM[0], afM[1]),
      centeredTop(afM[2], afM[3]),
      centeredTop(afM[4], afM[5]),
      centeredTop(afM[6], afM[7]),
    ]
    const qfM = mids(qfTops)
    const hfTops = [centeredTop(qfM[0], qfM[1]), centeredTop(qfM[2], qfM[3])]
    const hfM = mids(hfTops)
    const finalTop = centeredTop(hfM[0], hfM[1])
    const finM = finalTop + half

    return {
      totalH,
      afTops,
      qfTops,
      hfTops,
      finalTop,
      afQfPairs: [
        { in1: afM[0], in2: afM[1], out: qfM[0] },
        { in1: afM[2], in2: afM[3], out: qfM[1] },
        { in1: afM[4], in2: afM[5], out: qfM[2] },
        { in1: afM[6], in2: afM[7], out: qfM[3] },
      ],
      qfHfPairs: [
        { in1: qfM[0], in2: qfM[1], out: hfM[0] },
        { in1: qfM[2], in2: qfM[3], out: hfM[1] },
      ],
      hfFinalPairs: [{ in1: hfM[0], in2: hfM[1], out: finM }],
    }
  }

  if (isVF) {
    const qfTops = [
      0,
      SLOT_H + INNER_GAP,
      2 * SLOT_H + INNER_GAP + OUTER_GAP,
      3 * SLOT_H + 2 * INNER_GAP + OUTER_GAP,
    ]
    const totalH = 4 * SLOT_H + 2 * INNER_GAP + OUTER_GAP

    const qfM = mids(qfTops)
    const hfTops = [centeredTop(qfM[0], qfM[1]), centeredTop(qfM[2], qfM[3])]
    const hfM = mids(hfTops)
    const finalTop = centeredTop(hfM[0], hfM[1])
    const finM = finalTop + half

    return {
      totalH,
      afTops: [],
      qfTops,
      hfTops,
      finalTop,
      afQfPairs: [],
      qfHfPairs: [
        { in1: qfM[0], in2: qfM[1], out: hfM[0] },
        { in1: qfM[2], in2: qfM[3], out: hfM[1] },
      ],
      hfFinalPairs: [{ in1: hfM[0], in2: hfM[1], out: finM }],
    }
  }

  // HF-only
  const totalH = 2 * SLOT_H + INNER_GAP
  const hfTops = [0, SLOT_H + INNER_GAP]
  const hfM = mids(hfTops)
  const finalTop = centeredTop(hfM[0], hfM[1])
  const finM = finalTop + half

  return {
    totalH,
    afTops: [],
    qfTops: [],
    hfTops,
    finalTop,
    afQfPairs: [],
    qfHfPairs: [],
    hfFinalPairs: [{ in1: hfM[0], in2: hfM[1], out: finM }],
  }
}

// Berechnet die Vorschau-Namen (erwartete Teilnehmer) für noch leere Slots.
export function computePreviews(bracket: PlayoffBracketData, isAF: boolean, isVF: boolean) {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf } = bracket

  const qfPreviews: SlotPreview[] = isAF
    ? [
        { nameA: getWinnerName(af[0]), nameB: getWinnerName(af[1]) },
        { nameA: getWinnerName(af[2]), nameB: getWinnerName(af[3]) },
        { nameA: getWinnerName(af[4]), nameB: getWinnerName(af[5]) },
        { nameA: getWinnerName(af[6]), nameB: getWinnerName(af[7]) },
      ]
    : []

  const hfPreviews: SlotPreview[] =
    isAF || isVF
      ? [
          { nameA: getWinnerName(qf[0]), nameB: getWinnerName(qf[1]) },
          { nameA: getWinnerName(qf[2]), nameB: getWinnerName(qf[3]) },
        ]
      : []

  const finalPreview: SlotPreview = {
    nameA: getWinnerName(hf[0]),
    nameB: getWinnerName(hf[1]),
  }

  return { qfPreviews, hfPreviews, finalPreview }
}
