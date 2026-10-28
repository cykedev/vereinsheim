import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { EntryScreen } from "@/diary/components/EntryScreen"
import { requireDiary } from "@/diary/page-guard"
import { entryView } from "@/diary/queries"
import { dayLabel } from "@/diary/summaries"
import { db } from "@/lib/db"
import { resultFamilies, resultMarks } from "@/lib/results-read"

export const metadata: Metadata = { title: "Eintrag" }

// Seite eines Eintrags: nur der eigene, nicht im Papierkorb
export default async function EntryRoute({ params }: { params: Promise<{ id: string }> }) {
  const { userId, timeZone } = await requireDiary()
  const { id } = await params
  const entry = await entryView(db, userId, id, timeZone)
  if (!entry) notFound()
  const cardIds = [
    ...entry.cards.linked.flatMap(({ card }) => (card ? [card.id] : [])),
    ...entry.cards.added.map((card) => card.id),
  ]
  const [marks, families] = await Promise.all([
    resultMarks(db, { ownerId: userId, ids: cardIds }),
    resultFamilies(db, userId),
  ])
  return (
    <EntryScreen
      entry={entry}
      marks={marks}
      families={families}
      dayLabel={dayLabel(entry.day, timeZone)}
      threadDayLabel={entry.thread ? dayLabel(entry.thread.day, timeZone) : null}
      timeZone={timeZone}
      key={entry.id}
    />
  )
}
