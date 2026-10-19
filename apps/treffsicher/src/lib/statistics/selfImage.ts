// Selbstbild: je Bereich das Mittel der Prognose vor und des Feedbacks nach der Einheit über die Einheiten des
// Zeitraums mit beidem. Nur Zahlen, kein Urteil: Dafür sind es zu wenige Einheiten (G0).

import type { SelfImageKey, SelfImageValues } from "@/lib/statistics/sessions"

/** Bereiche in der Reihenfolge der Einheit, mit ihren Namen dort */
export const SELF_IMAGE_LABELS: Record<SelfImageKey, string> = {
  fitness: "Kondition",
  nutrition: "Ernährung",
  technique: "Technik",
  tactics: "Taktik",
  mentalStrength: "Mentale Stärke",
  environment: "Umfeld",
  equipment: "Material",
}

export interface SelfImageRow {
  key: SelfImageKey
  label: string
  prognosis: number
  feedback: number
  /** Feedback − Prognose: plus heißt besser als gedacht */
  delta: number
}

export interface SelfImage {
  /** Einheiten mit Prognose und Feedback */
  n: number
  /** eine Zeile je Bereich; leer ohne Einheit */
  rows: SelfImageRow[]
}

export function selfImage(
  sessions: readonly { prognosis: SelfImageValues | null; feedback: SelfImageValues | null }[]
): SelfImage {
  const both = sessions.filter(
    (s): s is { prognosis: SelfImageValues; feedback: SelfImageValues } =>
      s.prognosis !== null && s.feedback !== null
  )
  if (!both.length) return { n: 0, rows: [] }
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length
  const rows = (Object.keys(SELF_IMAGE_LABELS) as SelfImageKey[]).map((key) => {
    const prognosis = mean(both.map((s) => s.prognosis[key]))
    const feedback = mean(both.map((s) => s.feedback[key]))
    return { key, label: SELF_IMAGE_LABELS[key], prognosis, feedback, delta: feedback - prognosis }
  })
  return { n: both.length, rows }
}
