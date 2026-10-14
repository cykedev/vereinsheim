import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminOverview } from "@/components/admin/AdminOverview"
import { AdminTabs } from "@/components/admin/AdminTabs"
import { Page } from "@/components/shell/Page"
import { adminOverview } from "@/lib/admin/overview"
import { requireAdmin } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Admin" }

// Admin beginnt mit der Übersicht (P2c): was auf eine Entscheidung wartet und der Weg einer Scheibe
export default async function AdminRoute() {
  await requireAdmin()
  const model = await adminOverview(getDisplayTimeZone())
  return (
    <Page>
      <section className="grid max-w-3xl gap-4">
        <div className="grid gap-3">
          <AdminTabs current="overview" />
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Übersicht
          </h1>
          <p className="text-foreground-2">
            So kommen Scheiben aus dem Schützenhaus zu den Schützen.
          </p>
        </div>
        <AdminOverview model={model} />
      </section>
    </Page>
  )
}
