// Nahtstelle im Papierkorb: Einträge, Ziele und Abläufe des Tagebuchs neben den Scheiben ([[adr-033]]). Der Papierkorb kennt nur den
// Platz, den Satz darüber und ob etwas darin liegt.

import type { ReactNode } from "react"

import { DiaryTrash } from "@/diary/components/DiaryTrash"
import { diarySettings } from "@/diary/settings"
import { PROFILE_TEXTS } from "@/diary/texts"
import { diaryTrash, diaryTrashThings } from "@/diary/trash"
import type { Db } from "@/lib/db"

export async function trashParts(
  db: Db,
  userId: string,
  timeZone: string
): Promise<{ lead: string | null; content: ReactNode; count: number }> {
  if (!(await diarySettings(db, userId)).enabled) return { lead: null, content: null, count: 0 }
  const [items, things] = await Promise.all([
    diaryTrash(db, userId, timeZone),
    diaryTrashThings(db, userId),
  ])
  return {
    lead: PROFILE_TEXTS.trashLead,
    content: <DiaryTrash items={items} goals={things.goals} />,
    count: items.length + things.goals.length + things.routines.length,
  }
}
