// Nahtstelle für den Rahmen der App: ob das Tagebuch in der Leiste steht. Der Ergebnisteil fragt hier, nicht im
// Tagebuch ([[adr-033]]).

import { diarySettings } from "@/diary/settings"
import type { Db } from "@/lib/db"

export async function diaryEnabled(db: Db, userId: string): Promise<boolean> {
  return (await diarySettings(db, userId)).enabled
}
