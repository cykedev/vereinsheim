import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { RoutineForm } from "@/diary/components/RoutineForm"
import { requireDiary } from "@/diary/page-guard"
import { routineView } from "@/diary/routines/queries"
import { stepsToText } from "@/diary/routines/steps"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Ablauf bearbeiten" }

// Ablauf bearbeiten: Name und Schritte als ein Text
export default async function EditRoutineRoute({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireDiary()
  const { id } = await params
  const routine = await routineView(db, userId, id)
  if (!routine) notFound()
  return (
    <RoutineForm
      key={routine.id}
      routine={{
        id: routine.id,
        name: routine.name,
        family: routine.family,
        text: stepsToText(routine.steps),
      }}
      families={[]}
      familyId={null}
    />
  )
}
