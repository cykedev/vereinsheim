import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminTabs } from "@/components/admin/AdminTabs"
import { DisciplineForm } from "@/components/admin/DisciplineForm"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { disciplineDetail } from "@/lib/admin/disciplines"
import { requireAdmin } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Disziplin" }

// Blatt einer Disziplin (Admin): einordnen oder ignorieren; die Kennung aus der Adresse prüft `disciplineDetail`
export default async function AdminDisciplineRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const detail = /^\d{1,9}$/.test(id)
    ? await disciplineDetail(Number(id), getDisplayTimeZone())
    : null
  if (!detail) notFound()
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminTabs current="disciplines" detail />
        <DisciplineForm row={detail.row} families={detail.families} key={detail.row.id} />
      </section>
    </Page>
  )
}
