// Nahtstelle im Profil: was das Tagebuch dort zeigt. Das Profil kennt nur die Plätze, nicht das Tagebuch ([[adr-033]]).

import type { ReactNode } from "react"

import { DiaryProfileBox } from "@/diary/components/DiaryProfileBox"
import { diarySettings } from "@/diary/settings"
import type { Db } from "@/lib/db"

/**
 * Oben im Profil: der Kasten „Tagebuch“. Ist es an, sind die Scheiben am Telefon ein Reiter des Tagebuchs
 * (`@/parts/diary-tabs`), ab 1024 px stehen sie zusätzlich in der Seitenleiste.
 */
export async function profileParts(db: Db, userId: string): Promise<{ diary: ReactNode }> {
  const { enabled } = await diarySettings(db, userId)
  return {
    diary: <DiaryProfileBox enabled={enabled} />,
  }
}
