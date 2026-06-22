export const SLOT_H = 80 // px – Kartenhöhe
export const SLOT_W = 176 // px – w-44
export const CONN_W = 28 // px – SVG-Connector-Breite
export const INNER_GAP = 8 // px – Abstand zwischen den zwei Karten einer Paarung
export const OUTER_GAP = 48 // px – Abstand zwischen den Paarungsgruppen

// Gold / Silber / Bronze / Blau je nach Runde
export const WINNER_STYLE: Record<string, { row: string; text: string; badge: string }> = {
  FINAL: {
    row: "bg-yellow-400/5",
    text: "text-yellow-600 dark:text-yellow-400",
    badge: "bg-yellow-400/15 text-yellow-600 ring-1 ring-yellow-400 dark:text-yellow-400",
  },
  SEMI_FINAL: {
    row: "bg-slate-400/5",
    text: "text-slate-500 dark:text-slate-300",
    badge: "bg-slate-400/15 text-slate-500 ring-1 ring-slate-400 dark:text-slate-300",
  },
  QUARTER_FINAL: {
    row: "bg-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500 dark:text-orange-400",
  },
  EIGHTH_FINAL: {
    row: "bg-blue-500/5",
    text: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500 dark:text-blue-400",
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
