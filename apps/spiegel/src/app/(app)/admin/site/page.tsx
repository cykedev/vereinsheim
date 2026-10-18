import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminTabs } from "@/components/admin/AdminTabs"
import { BridgeItem, PairBridgeForm, RankingItem, SiteForm } from "@/components/admin/SiteForms"
import { AdminHelp } from "@/components/admin/AdminHelp"
import { Page } from "@vereinsheim/ui/design2/page"
import { requireAdmin } from "@/lib/auth-helpers"
import { siteOverview } from "@/lib/admin/site"

export const metadata: Metadata = { title: "Anlage" }

// Anlage und Brücke (Admin): Name und Zeitzone, gekoppelte Brücken, „Brücke koppeln“, Listen; jede Änderung mit
// Folgen fragt (`DecisionDialog`)
export default async function AdminSiteRoute() {
  await requireAdmin()
  const timeZone = getDisplayTimeZone()
  const overview = await siteOverview(timeZone)
  return (
    <Page>
      <section className="grid max-w-3xl gap-4">
        <div className="grid gap-3">
          <AdminTabs current="site" />
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Anlage und Brücke
          </h1>
          <p className="text-foreground-2">
            Die Brücke ist ein kleines Gerät im Schützenhaus. Sie liest die Scheiben der
            Meyton-Anlage und schickt Spiegel nur die von Schützen, die zugestimmt haben.
          </p>
        </div>
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
            <section className="grid gap-3 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-1 text-[15px] font-semibold">
                Listen <AdminHelp id="ranking" />
              </h2>
              <p className="text-sm text-muted-foreground">
                In Meyton gehört jede Scheibe zu einer Liste. Leg hier fest, welche Listen als
                Wettkampf zählen. Alle anderen zählen so, wie Meyton sie vermerkt. Meist ist das
                Training.
              </p>
              {overview.rankings.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {overview.rankings.map((ranking) => (
                    <RankingItem key={ranking.id} ranking={ranking} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Die Listen erscheinen hier, sobald die ersten Scheiben da sind.
                </p>
              )}
            </section>
          </>
        )}
      </section>
    </Page>
  )
}
