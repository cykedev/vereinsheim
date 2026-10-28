import type { Metadata } from "next"

import { cn } from "@vereinsheim/lib/utils"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Page } from "@vereinsheim/ui/design2/page"

import { DiaryHeader } from "@/diary/components/DiaryList"
import { RoutineList } from "@/diary/components/RoutineList"
import { requireDiary } from "@/diary/page-guard"
import { routineGroups } from "@/diary/routines/queries"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Abläufe" }

// Abläufe: je Disziplin, „Ohne Disziplin“ zuletzt
export default async function RoutinesRoute() {
  const { userId } = await requireDiary()
  const groups = await routineGroups(db, userId)
  return (
    <Page>
      <section data-routines-page className={cn("grid gap-5", PAGE_SINGLE)}>
        <DiaryHeader current="routines" />
        <RoutineList groups={groups} />
      </section>
    </Page>
  )
}
