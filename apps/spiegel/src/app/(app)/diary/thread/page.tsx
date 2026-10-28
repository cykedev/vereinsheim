import type { Metadata } from "next"

import { cn } from "@vereinsheim/lib/utils"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Page } from "@vereinsheim/ui/design2/page"

import { DiaryHeader } from "@/diary/components/DiaryList"
import { ThreadView } from "@/diary/components/ThreadView"
import { requireDiary } from "@/diary/page-guard"
import { threadView } from "@/diary/queries"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Fragen" }

// Fragen (der Faden): die Lernfragen einer Disziplin, neueste oben (`?family=` wählt die Disziplin)
export default async function ThreadRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId, timeZone } = await requireDiary()
  const family = (await searchParams).family
  const view = await threadView(db, userId, typeof family === "string" ? family : null)
  return (
    <Page>
      <section data-thread-page className={cn("grid gap-5", PAGE_SINGLE)}>
        <DiaryHeader current="thread" />
        <ThreadView {...view} timeZone={timeZone} />
      </section>
    </Page>
  )
}
