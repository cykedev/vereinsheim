import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminTabs } from "@/components/admin/AdminTabs"
import { RankingForm } from "@/components/admin/RankingForm"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { rankingDetail } from "@/lib/admin/rankings"
import { requireAdmin } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Liste" }

// Blatt einer Liste (Admin): ihre Art; die Kennung aus der Adresse prüft `rankingDetail`
export default async function AdminListRoute({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const row = /^\d{1,9}$/.test(id) ? await rankingDetail(Number(id), getDisplayTimeZone()) : null
  if (!row) notFound()
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminTabs current="lists" detail />
        <RankingForm row={row} key={row.id} />
      </section>
    </Page>
  )
}
