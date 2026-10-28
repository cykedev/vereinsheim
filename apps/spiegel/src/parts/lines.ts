// Nahtstelle für die Stellen im Ergebnisteil ([[adr-033]]): die Seite einer Scheibe (Kasten „Diese Scheibe“) und Start
// (je Block des letzten Abends) bekommen hier allgemeine Zeilen. Ist das Tagebuch aus, kommen keine.

import { entryForCard, eveningEntries } from "@/diary/queries"
import { diarySettings } from "@/diary/settings"
import { dayLabel } from "@/diary/summaries"
import type { Db } from "@/lib/db"
import type { PartLine } from "@/lib/part-line"

const TITLE = "Tagebuch"

/** die Zeile „Tagebuch“ an einer eigenen Scheibe: im Eintrag „Eintrag öffnen“, sonst „Eintrag anlegen“ */
export async function cardLines(
  db: Db,
  query: { ownerId: string; cardId: string; timeZone: string }
): Promise<PartLine[]> {
  if (!(await diarySettings(db, query.ownerId)).enabled) return []
  const entry = await entryForCard(db, query.ownerId, query.cardId, query.timeZone)
  return [
    entry
      ? {
          key: "diary",
          title: TITLE,
          state: `Im Eintrag vom ${dayLabel(entry.day, query.timeZone)}.`,
          href: `/diary/${entry.entryId}`,
          action: "Eintrag öffnen",
        }
      : {
          key: "diary",
          title: TITLE,
          state: "Noch in keinem Eintrag.",
          href: `/diary/new?card=${encodeURIComponent(query.cardId)}`,
          action: "Eintrag anlegen",
        },
  ]
}

/**
 * Je Block auf Start (Abend und Familie) eine Zeile: der Eintrag der neuesten Scheibe des Blocks, die in einem steckt,
 * sonst „Eintrag anlegen“ mit der neuesten Scheibe. Schlüssel `Tag|Familie`.
 */
export async function startLines(
  db: Db,
  query: {
    ownerId: string
    blocks: readonly { day: string; familySlug: string; cardIds: readonly string[] }[]
    timeZone: string
  }
): Promise<Record<string, PartLine>> {
  if (!query.blocks.length || !(await diarySettings(db, query.ownerId)).enabled) return {}
  const entries = await eveningEntries(db, query.ownerId, query.blocks, query.timeZone)
  const lines: Record<string, PartLine> = {}
  for (const block of query.blocks) {
    const key = `${block.day}|${block.familySlug}`
    const entryId = entries.get(key)
    const newest = block.cardIds[block.cardIds.length - 1]
    lines[key] = entryId
      ? { key, title: TITLE, state: "", href: `/diary/${entryId}`, action: "Eintrag öffnen" }
      : {
          key,
          title: TITLE,
          state: "",
          href: `/diary/new?card=${encodeURIComponent(newest)}`,
          action: "Eintrag anlegen",
        }
  }
  return lines
}
