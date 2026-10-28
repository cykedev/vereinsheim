import type { Metadata } from "next"

import { cn } from "@vereinsheim/lib/utils"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Page } from "@vereinsheim/ui/design2/page"

import { DiaryHeader, DiaryList, LIST_IMAGES } from "@/diary/components/DiaryList"
import { DiaryNotice } from "@/diary/components/DiaryNotice"
import { requireDiary } from "@/diary/page-guard"
import { diaryList } from "@/diary/queries"
import { db } from "@/lib/db"
import { resultMarks } from "@/lib/results-read"

export const metadata: Metadata = { title: "Tagebuch" }

// Tagebuch: die Einträge nach Monat, beim ersten Öffnen darüber der Hinweis
export default async function DiaryRoute() {
  const { userId, noticeSeen, timeZone } = await requireDiary()
  const entries = await diaryList(db, userId, timeZone)
  const marks = await resultMarks(db, {
    ownerId: userId,
    ids: entries.flatMap((entry) => entry.cards.slice(0, LIST_IMAGES).map((card) => card.id)),
  })
  return (
    <Page>
      <section data-diary-page className={cn("grid gap-5", PAGE_SINGLE)}>
        <DiaryHeader current="entries" />
        {!noticeSeen && <DiaryNotice />}
        <DiaryList entries={entries} marks={marks} timeZone={timeZone} />
      </section>
    </Page>
  )
}
