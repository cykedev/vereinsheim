// Einstellung des Tagebuchs je Konto ([[adr-033]] „Tagebuch abschaltbar“): ohne Zeile aus, der Hinweis beim ersten
// Öffnen ungesehen. Ausgeschaltet bleiben die Einträge erhalten.

import type { Db } from "@/lib/db"

export interface DiarySettingsView {
  enabled: boolean
  noticeSeen: boolean
}

export async function diarySettings(db: Db, userId: string): Promise<DiarySettingsView> {
  const row = await db.diarySettings.findUnique({
    where: { userId },
    select: { enabled: true, noticeSeenAt: true },
  })
  return { enabled: row?.enabled ?? false, noticeSeen: row?.noticeSeenAt != null }
}

export async function setDiaryEnabled(db: Db, userId: string, enabled: boolean): Promise<void> {
  await db.diarySettings.upsert({
    where: { userId },
    create: { userId, enabled },
    update: { enabled },
  })
}

/** der Hinweis „Nur du siehst dein Tagebuch“ ist gesehen; ein zweites Mal ändert nichts */
export async function markNoticeSeen(db: Db, userId: string): Promise<void> {
  await db.diarySettings.upsert({
    where: { userId },
    create: { userId, noticeSeenAt: new Date() },
    update: {},
  })
  await db.diarySettings.updateMany({
    where: { userId, noticeSeenAt: null },
    data: { noticeSeenAt: new Date() },
  })
}
