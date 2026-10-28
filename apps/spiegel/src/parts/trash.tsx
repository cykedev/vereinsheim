// Nahtstelle im Papierkorb: die Einträge des Tagebuchs neben den Scheiben ([[adr-033]]). Der Papierkorb kennt nur den
// Platz, den Satz darüber und ob etwas darin liegt.

import type { ReactNode } from "react"

import { DiaryTrash } from "@/diary/components/DiaryTrash"
import { diarySettings } from "@/diary/settings"
import { diaryTrash } from "@/diary/trash"
import type { Db } from "@/lib/db"

export async function trashParts(
  db: Db,
  userId: string,
  timeZone: string
): Promise<{ lead: string | null; content: ReactNode; count: number }> {
  if (!(await diarySettings(db, userId)).enabled) return { lead: null, content: null, count: 0 }
  const items = await diaryTrash(db, userId, timeZone)
  return {
    lead: "Gelöschte Scheiben und Einträge liegen hier 30 Tage und zählen nirgends mit. Danach werden sie endgültig gelöscht.",
    content: <DiaryTrash items={items} />,
    count: items.length,
  }
}
