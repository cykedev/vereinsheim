// Stufen des Tagebuchs: Befinden, Prognose, Feedback und Ausführung je Serie liegen auf 0 bis 100 (wie in Treffsicher)
// und zeigen sich als fünf Stufen. Ein Tipp speichert die Mitte der Stufe, übernommene Werte bleiben genau. Reine
// Funktionen; die Aspekte je Teil stehen nur hier.

import { z } from "zod"

/** die Aspekte je Teil, in der Reihenfolge der Seite; `DiaryScale.aspect` nimmt nur diese */
export const SCALE_ASPECTS = {
  wellbeing: ["sleep", "energy", "stress", "motivation"],
  prognosis: [
    "fitness",
    "nutrition",
    "technique",
    "tactics",
    "mentalStrength",
    "environment",
    "equipment",
  ],
  feedback: [
    "fitness",
    "nutrition",
    "technique",
    "tactics",
    "mentalStrength",
    "environment",
    "equipment",
  ],
} as const

export type ScalePart = keyof typeof SCALE_ASPECTS
export type ScaleAspect = (typeof SCALE_ASPECTS)[ScalePart][number]

export const SCALE_PARTS = Object.keys(SCALE_ASPECTS) as ScalePart[]

export function isAspectOf(part: ScalePart, aspect: string): aspect is ScaleAspect {
  return (SCALE_ASPECTS[part] as readonly string[]).includes(aspect)
}

/** ein Wert auf der Skala, wie die Datenbank ihn hält */
export const scaleValue = z.number().int().min(0).max(100)

/** Teil, Aspekt und Wert eines Eintrags; ein Aspekt, der nicht zum Teil gehört, ist ungültig */
export const scaleEntry = z
  .object({
    part: z.enum(["wellbeing", "prognosis", "feedback"]),
    aspect: z.string(),
    value: scaleValue,
  })
  .refine((entry) => isAspectOf(entry.part, entry.aspect), { message: "aspect" })

export type Stage = 1 | 2 | 3 | 4 | 5
export const STAGES: readonly Stage[] = [1, 2, 3, 4, 5]

/** die Stufe eines Werts: 0–19 → 1, 20–39 → 2, 40–59 → 3, 60–79 → 4, 80–100 → 5 */
export function stageOf(value: number): Stage {
  return Math.min(5, Math.max(1, Math.floor(value / 20) + 1)) as Stage
}

/** der Wert, den ein Tipp auf eine Stufe speichert: ihre Mitte */
export function valueOfStage(stage: Stage): number {
  return stage * 20 - 10
}

/** Namen der Aspekte auf der Seite */
export const ASPECT_LABELS: Readonly<Record<ScaleAspect, string>> = {
  sleep: "Schlaf",
  energy: "Energie",
  stress: "Stress",
  motivation: "Motivation",
  fitness: "Kondition",
  nutrition: "Ernährung",
  technique: "Technik",
  tactics: "Taktik",
  mentalStrength: "Mentale Stärke",
  environment: "Umfeld",
  equipment: "Material",
}

/** Wörter der fünf Stufen: wie viel, oder wie gut */
export const AMOUNT_WORDS = ["sehr wenig", "wenig", "mittel", "viel", "sehr viel"] as const
export const QUALITY_WORDS = ["schlecht", "mäßig", "mittel", "gut", "sehr gut"] as const

/**
 * die Wörter einer Zeile: Beim Befinden sagen sie „wie viel“, nur der Schlaf „wie gut“ (bei Stress ist viel schlecht,
 * beim Schlaf ist gut gut); Prognose, Feedback und Ausführung „wie gut“
 */
export function stageWords(part: ScalePart | "execution", aspect?: string): readonly string[] {
  if (part === "wellbeing" && aspect !== "sleep") return AMOUNT_WORDS
  return QUALITY_WORDS
}

/** das Wort eines Werts in seiner Zeile */
export function wordOf(value: number, part: ScalePart | "execution", aspect?: string): string {
  return stageWords(part, aspect)[stageOf(value) - 1]
}
