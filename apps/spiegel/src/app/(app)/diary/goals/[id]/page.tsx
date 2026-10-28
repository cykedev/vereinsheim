import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GoalScreen } from "@/diary/components/GoalScreen"
import { goalView } from "@/diary/goals/queries"
import { requireDiary } from "@/diary/page-guard"
import { db } from "@/lib/db"
import { resultMarks } from "@/lib/results-read"

export const metadata: Metadata = { title: "Ziel" }

// Seite eines Ziels: nur das eigene, nicht im Papierkorb
export default async function GoalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { userId, timeZone } = await requireDiary()
  const { id } = await params
  const goal = await goalView(db, userId, id, timeZone)
  if (!goal) notFound()
  const marks = await resultMarks(db, {
    ownerId: userId,
    ids: goal.entryList.flatMap((entry) => (entry.cards[0] ? [entry.cards[0].id] : [])),
  })
  return <GoalScreen key={goal.id} goal={goal} marks={marks} timeZone={timeZone} />
}
