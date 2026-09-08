import type { TrainingSession } from "@/generated/prisma/client"

export type SessionType = TrainingSession["type"]

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  TRAINING: "Training",
  WETTKAMPF: "Wettkampf",
  TROCKENTRAINING: "Trockentraining",
  MENTAL: "Mentaltraining",
}

export const SESSION_TYPE_BADGE_CLASS: Record<SessionType, string> = {
  TRAINING: "border-info/40 bg-info/10 text-info",
  WETTKAMPF: "border-warning/40 bg-warning/10 text-warning",
  TROCKENTRAINING: "border-success/40 bg-success/10 text-success",
  MENTAL: "border-chart-4/40 bg-chart-4/10 text-chart-4",
}

export const SESSION_TYPES_WITH_DISCIPLINE: SessionType[] = ["TRAINING", "WETTKAMPF"]

export const EXECUTION_QUALITY_LABELS: Record<number, string> = {
  1: "1 – Schlecht",
  2: "2 – Mässig",
  3: "3 – Mittel",
  4: "4 – Gut",
  5: "5 – Sehr gut",
}

export function needsDisciplineForSessionType(type: string): boolean {
  return SESSION_TYPES_WITH_DISCIPLINE.includes(type as SessionType)
}
