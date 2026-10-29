import type { Metadata } from "next"

import { GoalForm } from "@/diary/components/GoalForm"
import { goalFormFamilies, todayIn } from "@/diary/goals/queries"
import { nextSeason, seasonOf } from "@/diary/goals/season"
import { requireDiary } from "@/diary/page-guard"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Neues Ziel" }

// Neues Ziel: vorbelegt mit der laufenden Saison und der Disziplin der neuesten Scheibe
export default async function NewGoalRoute() {
  const { userId, timeZone } = await requireDiary()
  const today = todayIn(timeZone)
  const families = await goalFormFamilies(db, userId, timeZone)
  return (
    <GoalForm
      goalId={null}
      goal={null}
      families={families}
      seasons={{ current: seasonOf(today), next: nextSeason(today) }}
      timeZone={timeZone}
    />
  )
}
