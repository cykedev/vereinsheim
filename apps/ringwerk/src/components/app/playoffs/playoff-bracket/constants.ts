export const SLOT_H = 80 // px – Kartenhöhe
export const SLOT_W = 176 // px – w-44
export const CONN_W = 28 // px – SVG-Connector-Breite
export const INNER_GAP = 8 // px – Abstand zwischen den zwei Karten einer Paarung
export const OUTER_GAP = 48 // px – Abstand zwischen den Paarungsgruppen

// Gold / Silber / Bronze / info je nach Runde (semantische Tokens)
export const WINNER_STYLE: Record<string, { row: string; text: string; badge: string }> = {
  FINAL: {
    row: "bg-rank-1/10",
    text: "text-rank-1",
    badge: "bg-rank-1/15 text-rank-1 ring-1 ring-rank-1",
  },
  SEMI_FINAL: {
    row: "bg-rank-2/10",
    text: "text-rank-2",
    badge: "bg-rank-2/15 text-rank-2 ring-1 ring-rank-2",
  },
  QUARTER_FINAL: {
    row: "bg-rank-3/10",
    text: "text-rank-3",
    badge: "bg-rank-3/15 text-rank-3 ring-1 ring-rank-3",
  },
  EIGHTH_FINAL: {
    row: "bg-info/10",
    text: "text-info",
    badge: "bg-info/15 text-info ring-1 ring-info",
  },
}

export interface SlotPreview {
  nameA?: string
  nameB?: string
}

export interface ConnectorPair {
  in1: number // y-Mittelpunkt erster Eingang
  in2: number // y-Mittelpunkt zweiter Eingang
  out: number // y-Mittelpunkt Ausgang
}
