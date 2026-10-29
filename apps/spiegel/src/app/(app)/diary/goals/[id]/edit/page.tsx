import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GoalForm } from "@/diary/components/GoalForm"
import { goalForEdit, goalFormFamilies, todayIn } from "@/diary/goals/queries"
import { nextSeason, seasonOf } from "@/diary/goals/season"
import { requireDiary } from "@/diary/page-guard"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Ziel ändern" }

// Ziel ändern: Satz, Art, Disziplin, Zeitraum und Messung; nur das eigene, nicht im Papierkorb
export default async function EditGoalRoute({ params }: { params: Promise<{ id: string }> }) {
  const { userId, timeZone } = await requireDiary()
  const { id } = await params
  const [goal, families] = await Promise.all([
    goalForEdit(db, userId, id),
    goalFormFamilies(db, userId, timeZone),
  ])
  if (!goal) notFound()
  const today = todayIn(timeZone)
  return (
    <GoalForm
      key={goal.id}
      goalId={goal.id}
      goal={goal}
      families={families}
      seasons={{ current: seasonOf(today), next: nextSeason(today) }}
      timeZone={timeZone}
    />
  )
}
