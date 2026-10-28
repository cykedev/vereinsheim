import type { Metadata } from "next"

import { cn } from "@vereinsheim/lib/utils"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Page } from "@vereinsheim/ui/design2/page"

import { DiaryHeader } from "@/diary/components/DiaryList"
import { GoalList } from "@/diary/components/GoalList"
import { goalList } from "@/diary/goals/queries"
import { requireDiary } from "@/diary/page-guard"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Ziele" }

// Ziele: laufend, kommend, vorbei, je mit Stand
export default async function GoalsRoute() {
  const { userId, timeZone } = await requireDiary()
  const groups = await goalList(db, userId, timeZone)
  return (
    <Page>
      <section data-goals-page className={cn("grid gap-5", PAGE_SINGLE)}>
        <DiaryHeader current="goals" />
        <GoalList groups={groups} timeZone={timeZone} />
      </section>
    </Page>
  )
}
