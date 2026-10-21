import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { routeFromUrl } from "@vereinsheim/shot-ui/nav/routes"
import { Page } from "@vereinsheim/ui/design2/page"

import { CompareScreen } from "@/components/compare/CompareScreen"
import { NoCards } from "@/components/shell/NoCards"
import { requireSession } from "@/lib/auth-helpers"
import { comparePageData } from "@/lib/compare"
import { db } from "@/lib/db"
import { pageContext } from "@/lib/page-context"
import { searchOf } from "@/lib/search"

export const metadata: Metadata = { title: "Vergleichen" }

// Vergleichen: A gegen B über die eigenen Scheiben, zwei Scheiben, zwei Zeiträume oder Wettkampf und Training. Die
// Wahl steht in der Adresse; der Server rechnet das Modell (`comparePageData`) und gibt es dem Browser.
export default async function CompareRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireSession()
  const route = routeFromUrl("/compare", searchOf(await searchParams), "")
  if (route.page !== "compare") notFound()
  const context = await pageContext(session.user.id)
  const data = await comparePageData(db, session.user.id, route.query, context)
  if (!data)
    return (
      <Page>
        <NoCards />
      </Page>
    )
  return (
    <CompareScreen data={data} context={{ timeZone: context.timeZone, named: context.named }} />
  )
}
