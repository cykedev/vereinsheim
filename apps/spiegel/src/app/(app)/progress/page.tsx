import type { Metadata } from "next"

import { DEFAULT_PROGRESS, routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import { ProgressScreen } from "@/components/progress/ProgressScreen"
import { requireSession } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { progressPageData } from "@/lib/overview"
import { pageContext } from "@/lib/page-context"
import { searchOf } from "@/lib/search"

export const metadata: Metadata = { title: "Fortschritt" }

// Fortschritt: die Seite eines Zeitraums über die eigenen Scheiben einer Familie. Filter stehen in der Adresse; die Seite
// rechnet `periodModel` auf dem Server aus den Projektionen (ADR-031) und gibt dem Browser das leichte Modell und die
// Lagen der Scheibe, die die Ablesung zeigt. Die Wertung ist die des Geräts.
export default async function ProgressRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const route = routeFromUrl("/progress", searchOf(await searchParams), "")
  const query = route.page === "progress" ? route.query : DEFAULT_PROGRESS
  const context = await pageContext(session.user.id)
  const { progress, families } = await progressPageData(db, session.user.id, query, context)
  if (!progress)
    return (
      <Page>
        <NoCards />
      </Page>
    )
  return (
    <ProgressScreen
      model={progress.model}
      state={progress.state}
      marks={progress.marks}
      families={families}
      context={context}
    />
  )
}
