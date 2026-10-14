import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminTabs } from "@/components/admin/AdminTabs"
import { BridgeItem, PairBridgeForm, RankingItem, SiteForm } from "@/components/admin/SiteForms"
import { AdminHelp } from "@/components/admin/AdminHelp"
import { Page } from "@/components/shell/Page"
import { requireAdmin } from "@/lib/auth-helpers"
import { siteOverview } from "@/lib/admin/site"

export const metadata: Metadata = { title: "Anlage" }

// Anlage und Brücke (Admin, SP-1.6 b, P2c): Name und Zeitzone, gekoppelte Brücken, „Brücke koppeln“, Ranglisten; jede
// Änderung mit Folgen fragt (`DecisionDialog`)
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
            Die Brücke liest die Meyton-Ablage im Schützenhaus und schickt Spiegel die Scheiben der
            Schützen mit Zustimmung.
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
                <p className="text-sm text-muted-foreground">Noch keine Brücke gekoppelt.</p>
              )}
            </section>
            <PairBridgeForm />
            <section className="grid gap-3 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-1 text-[15px] font-semibold">
                Ranglisten <AdminHelp id="ranking" />
              </h2>
              <p className="text-sm text-muted-foreground">
                Ordne zu, welche Ranglisten als Wettkampf zählen; ohne Zuordnung ist es Training.
                Spiegel fragt vor jeder Änderung und sagt, wie viele Scheiben sie betrifft.
              </p>
              {overview.rankings.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {overview.rankings.map((ranking) => (
                    <RankingItem key={ranking.id} ranking={ranking} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Die Ranglisten erscheinen mit den ersten Scheiben der Brücke.
                </p>
              )}
            </section>
          </>
        )}
      </section>
    </Page>
  )
}
