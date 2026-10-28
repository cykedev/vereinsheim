// Export des Tagebuchs als eigener Teil ([[adr-033]] „Datenschutz des Tagebuchs“): Einstellung, alle Einträge, Ziele
// und Abläufe mit allen Feldern und Werten, auch die im Papierkorb; Scheiben und Familien als Kennung.

import type { Db } from "@/lib/db"

import { dayOfDate } from "./validation"

export async function diaryExport(db: Db, userId: string): Promise<unknown> {
  const [settings, entries, goals, routines] = await Promise.all([
    db.diarySettings.findUnique({
      where: { userId },
      select: { enabled: true, noticeSeenAt: true },
    }),
    db.diaryEntry.findMany({
      where: { userId },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
      include: {
        cards: { select: { cardId: true, link: true } },
        scales: { select: { part: true, aspect: true, value: true } },
        executions: { select: { cardId: true, series: true, value: true } },
      },
    }),
    db.diaryGoal.findMany({ where: { userId }, orderBy: [{ from: "asc" }, { createdAt: "asc" }] }),
    db.diaryRoutine.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ])
  return {
    settings: { enabled: settings?.enabled ?? false, noticeSeenAt: settings?.noticeSeenAt ?? null },
    entries: entries.map((entry) => ({
      id: entry.id,
      day: dayOfDate(entry.day),
      kind: entry.kind,
      familyId: entry.familyId,
      intention: entry.intention,
      note: entry.note,
      outcome: entry.outcome,
      learned: entry.learned,
      question: entry.question,
      disturbed: entry.disturbed,
      expectedScore: entry.expectedScore === null ? null : Number(entry.expectedScore),
      deletedAt: entry.deletedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      cards: entry.cards,
      scales: entry.scales,
      executions: entry.executions,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      note: goal.note,
      kind: goal.kind,
      familyId: goal.familyId,
      from: dayOfDate(goal.from),
      to: dayOfDate(goal.to),
      measure: goal.measure,
      threshold: goal.threshold === null ? null : Number(goal.threshold),
      scoring: goal.scoring,
      shots: goal.shots,
      cards: goal.cards,
      outcome: goal.outcome,
      deletedAt: goal.deletedAt,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    })),
    routines: routines.map((routine) => ({
      id: routine.id,
      name: routine.name,
      familyId: routine.familyId,
      steps: routine.steps,
      deletedAt: routine.deletedAt,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
    })),
  }
}
