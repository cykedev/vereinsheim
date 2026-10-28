// Nahtstelle für die Stellen im Ergebnisteil ([[adr-033]]): die Seite einer Scheibe (Kasten „Diese Scheibe“) und Start
// (je Block des letzten Abends) bekommen hier allgemeine Zeilen. Ist das Tagebuch aus, kommen keine. Jede Zeile führt
// dorthin, wo sich etwas tun lässt (`cardPlace`).

import { createEntryForCard } from "@/diary/actions"
import { cardPlaceOf, eveningEntries } from "@/diary/queries"
import { diarySettings } from "@/diary/settings"
import { dayLabel } from "@/diary/summaries"
import type { Db } from "@/lib/db"
import type { PartLine } from "@/lib/part-line"

const TITLE = "Tagebuch"

/**
 * die Zeile „Tagebuch“ an einer eigenen Scheibe: im Eintrag „Eintrag öffnen“, angeboten der Eintrag, der sie anbietet,
 * sonst „Eintrag anlegen“, das den Eintrag direkt anlegt und öffnet
 */
export async function cardLines(
  db: Db,
  query: { ownerId: string; cardId: string; timeZone: string }
): Promise<PartLine[]> {
  if (!(await diarySettings(db, query.ownerId)).enabled) return []
  const found = await cardPlaceOf(db, query.ownerId, query.cardId, query.timeZone)
  if (!found) return []
  const { place, day } = found
  const when = day ? dayLabel(day, query.timeZone) : ""
  switch (place.kind) {
    case "entry":
      return [line(`Im Eintrag vom ${when}.`, `/diary/${place.entryId}`, "Eintrag öffnen")]
    case "offered":
      return [
        line(
          `Noch in keinem Eintrag. Im Eintrag vom ${when} unter „Scheiben ändern“ anhaken.`,
          `/diary/${place.entryId}`,
          "Eintrag öffnen"
        ),
      ]
    case "none":
      return [
        {
          ...line("Noch in keinem Eintrag.", newHref(query.cardId), "Eintrag anlegen"),
          run: createEntryForCard.bind(null, query.cardId),
        },
      ]
  }
}

/** ohne Skript der Weg über „Neuer Eintrag“ mit dem Abend dieser Scheibe */
const newHref = (cardId: string) => `/diary/new?card=${encodeURIComponent(cardId)}`

const line = (state: string, href: string, action: string): PartLine => ({
  key: "diary",
  title: TITLE,
  state,
  href,
  action,
})

/**
 * Je Block auf Start (Abend und Familie) eine Zeile: der Eintrag der neuesten Scheibe des Blocks, die in einem steckt
 * oder angeboten ist, sonst „Eintrag anlegen“ mit der neuesten freien Scheibe (legt direkt an). Schlüssel `Tag|Familie`.
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
  const targets = await eveningEntries(db, query.ownerId, query.blocks, query.timeZone)
  const lines: Record<string, PartLine> = {}
  for (const block of query.blocks) {
    const key = `${block.day}|${block.familySlug}`
    const target = targets.get(key)
    if (!target) continue
    lines[key] =
      "entryId" in target
        ? {
            key,
            title: TITLE,
            state: "",
            href: `/diary/${target.entryId}`,
            action: "Eintrag öffnen",
          }
        : {
            key,
            title: TITLE,
            state: "",
            href: newHref(target.cardId),
            action: "Eintrag anlegen",
            run: createEntryForCard.bind(null, target.cardId),
          }
  }
  return lines
}
