import { redirect } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

import { diarySettings } from "./settings"

/** jede Seite des Tagebuchs: Sitzung, Tagebuch eingeschaltet (sonst ins Profil, dort lässt es sich einschalten), Zone */
export async function requireDiary(): Promise<{
  userId: string
  noticeSeen: boolean
  timeZone: string
}> {
  const session = await requireSession()
  const settings = await diarySettings(db, session.user.id)
  if (!settings.enabled) redirect("/profile")
  return {
    userId: session.user.id,
    noticeSeen: settings.noticeSeen,
    timeZone: getDisplayTimeZone(),
  }
}
