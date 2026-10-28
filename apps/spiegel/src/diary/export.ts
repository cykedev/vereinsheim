// Export des Tagebuchs als eigener Teil ([[adr-033]] „Datenschutz des Tagebuchs“): Einstellung und alle Einträge
// mit allen Feldern und Werten, auch die im Papierkorb; Scheiben als Kennung.

import type { Db } from "@/lib/db"

import { dayOfDate } from "./validation"

export async function diaryExport(db: Db, userId: string): Promise<unknown> {
  const [settings, entries] = await Promise.all([
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
  }
}
