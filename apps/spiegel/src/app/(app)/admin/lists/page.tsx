import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { RankingList } from "@/components/admin/RankingList"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { rankingOverview } from "@/lib/admin/rankings"
import { requireAdmin } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Listen" }

// Listen (Admin): die Listen aus Meyton in Abschnitten nach ihrer Art, wie die Disziplinen; die Art stellt das Blatt einer
// Liste um
export default async function AdminListsRoute() {
  await requireAdmin()
  const rows = await rankingOverview(getDisplayTimeZone())
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminHeader current="lists" title="Listen" help="ranking">
          In Meyton gehört jede Scheibe zu einer Liste. Leg hier fest, welche Listen als Wettkampf
          zählen. Alle anderen zählen so, wie Meyton sie vermerkt. Meist ist das Training.
        </AdminHeader>
        {rows.length ? (
          <RankingList rows={rows} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Die Listen erscheinen hier, sobald die ersten Scheiben da sind.
          </p>
        )}
      </section>
    </Page>
  )
}
