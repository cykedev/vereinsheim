import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { NewEntryScreen } from "@/diary/components/NewEntryScreen"
import { requireDiary } from "@/diary/page-guard"
import { cardPlaceOf, newEntryView } from "@/diary/queries"
import { db } from "@/lib/db"
import { resultMarks } from "@/lib/results-read"

export const metadata: Metadata = { title: "Neuer Eintrag" }

// Neuer Eintrag: Vorschläge je Abend und Disziplin; `?card=` markiert den Abend dieser Scheibe, steckt sie schon in
// einem Eintrag oder bietet einer sie an, geht es dorthin
export default async function NewEntryRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId, timeZone } = await requireDiary()
  const card = (await searchParams).card
  const cardId = typeof card === "string" && card.length <= 64 ? card : null
  if (cardId) {
    const found = await cardPlaceOf(db, userId, cardId, timeZone)
    if (found && (found.place.kind === "entry" || found.place.kind === "offered"))
      redirect(`/diary/${found.place.entryId}`)
  }
  const view = await newEntryView(db, userId, timeZone, cardId)
  const marks = await resultMarks(db, {
    ownerId: userId,
    ids: view.proposals.flatMap((p) => p.cards.map((c) => c.id)),
  })
  return <NewEntryScreen {...view} marks={marks} timeZone={timeZone} />
}
