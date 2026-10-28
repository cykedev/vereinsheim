import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RoutineScreen } from "@/diary/components/RoutineScreen"
import { requireDiary } from "@/diary/page-guard"
import { routineView } from "@/diary/routines/queries"
import { db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

export const metadata: Metadata = { title: "Ablauf" }

// Ein Ablauf zum Lesen: nur der eigene, nicht im Papierkorb
export default async function RoutineRoute({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireDiary()
  const { id } = await params
  const [routine, families] = await Promise.all([
    routineView(db, userId, id),
    resultFamilies(db, userId),
  ])
  if (!routine) notFound()
  return <RoutineScreen key={routine.id} routine={routine} families={families} />
}
