import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminHeader } from "@/components/admin/AdminHeader"
import { BridgeItem, PairBridgeForm, SiteForm } from "@/components/admin/SiteForms"
import { AdminHelp } from "@/components/admin/AdminHelp"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { requireAdmin } from "@/lib/auth-helpers"
import { siteOverview } from "@/lib/admin/site"

export const metadata: Metadata = { title: "Anlage" }

// Anlage und Brücke (Admin): Name und Zeitzone, gekoppelte Brücken, „Brücke koppeln“; jede Änderung mit Folgen fragt
// (`DecisionDialog`). Die Listen aus Meyton haben einen eigenen Bereich (`/admin/lists`).
export default async function AdminSiteRoute() {
  await requireAdmin()
  const timeZone = getDisplayTimeZone()
  const overview = await siteOverview(timeZone)
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <AdminHeader current="site" title="Anlage und Brücke">
          Die Brücke ist ein kleines Gerät im Schützenhaus. Sie liest die Scheiben der Meyton-Anlage
          und schickt Spiegel nur die von Schützen, die zugestimmt haben.
        </AdminHeader>
        <SiteForm site={overview.site} />
        {overview.site && (
          <>
            <section className="grid gap-3 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-1 text-[15px] font-semibold">
                Brücke im Schützenhaus <AdminHelp id="bridge" />
              </h2>
              {overview.bridges.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {overview.bridges.map((bridge) => (
                    <BridgeItem key={bridge.id} bridge={bridge} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Brücke verbunden.</p>
              )}
            </section>
            <PairBridgeForm />
          </>
        )}
      </section>
    </Page>
  )
}
