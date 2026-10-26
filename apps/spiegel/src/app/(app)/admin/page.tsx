import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminOverview } from "@/components/admin/AdminOverview"
import { AdminHeader } from "@/components/admin/AdminHeader"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { adminOverview } from "@/lib/admin/overview"
import { requireAdmin } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Admin" }

// Admin beginnt mit der Übersicht: was auf eine Entscheidung wartet und der Weg einer Scheibe
export default async function AdminRoute() {
  await requireAdmin()
  const model = await adminOverview(getDisplayTimeZone())
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminHeader current="overview" title="Übersicht">
          So kommen Scheiben aus dem Schützenhaus zu den Schützen.
        </AdminHeader>
        <AdminOverview model={model} />
      </section>
    </Page>
  )
}
