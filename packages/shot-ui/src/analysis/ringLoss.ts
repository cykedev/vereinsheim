// Was Kachel und Legende zum Ringverlust zeigen (Plan U3, D10, Review): Lage und Streuung so, dass sie zusammen den
// Ringverlust ergeben. Alle Zahlen kommen aus `ringLossSplit` des Fachkerns; hier wird nur gewählt, welche gezeigt wird.

import type { RingLossSplit } from "@vereinsheim/shot-core/analysis"

export interface ShownRingLoss {
  /** Lage-Anteil; null, wenn er gerundet nicht über null liegt („Lage kostet nichts“) */
  position: number | null
  /** Streuung; kostet die Lage nichts, trägt sie den ganzen Verlust (Streuung plus Lage-Anteil) */
  spread: number
  /** der Lage-Anteil, wenn er gerundet unter null liegt: für den Satz mit dem Grund im Reiter Lage */
  negative: number | null
}

/**
 * Aufteilung für die Anzeige: Ein Lage-Anteil bis null ist kein Gewinn, die Gruppe sitzt schon gut. Dann zeigt die
 * Streuung den ganzen Verlust, sonst stünde „Lage kostet nichts“ neben einer Streuung über dem Ringverlust. Gerundet
 * wird wie gezeigt (ganze Ringe ohne, Zehntel mit einer Stelle), damit nie „Lage 0,0“ dasteht.
 */
export function shownRingLoss(split: RingLossSplit, key: "rings" | "decimal"): ShownRingLoss {
  const scale = key === "rings" ? 1 : 10
  const position = split.positionLoss[key]
  const rounded = Math.round(position * scale)
  if (rounded > 0) return { position, spread: split.spreadLoss[key], negative: null }
  return {
    position: null,
    spread: split.spreadLoss[key] + position,
    negative: rounded < 0 ? position : null,
  }
}
