// Nahtstelle für die Liste der Scheiben: Mit Tagebuch sind die Scheiben ein Reiter des Tagebuchs, und `/cards` zeigt
// dieselbe Reiterzeile wie das Tagebuch ([[adr-033]]). Die Liste fragt hier, nicht im Tagebuch.

import type { ReactNode } from "react"

import { DiaryTabs } from "@/diary/components/DiaryTabs"
import type { Db } from "@/lib/db"

import { diaryEnabled } from "./nav"

/** die Reiterzeile des Tagebuchs mit „Scheiben“ gezeigt; ohne Tagebuch null */
export async function cardsDiaryTabs(db: Db, userId: string): Promise<ReactNode> {
  return (await diaryEnabled(db, userId)) ? <DiaryTabs current="cards" /> : null
}
