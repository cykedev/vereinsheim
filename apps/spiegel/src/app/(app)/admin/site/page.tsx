import type { Metadata } from "next"

import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

import { AdminTabs } from "@/components/admin/AdminTabs"
import {
  BridgeItem,
  ConfirmEpochButton,
  PairBridgeForm,
  RankingItem,
  SiteForm,
} from "@/components/admin/SiteForms"
import { Page } from "@/components/shell/Page"
import { requireAdmin } from "@/lib/auth-helpers"
import { siteOverview } from "@/lib/admin/site"

export const metadata: Metadata = { title: "Anlage" }

// Anlage und Brücken (Admin, SP-1.6 b): Name und Zeitzone, Epochen der Ablage, gekoppelte Brücken, „Brücke koppeln“
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
            Anlage und Brücken
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
              <h2 className="text-[15px] font-semibold">Brücken</h2>
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
              <h2 className="text-[15px] font-semibold">Ranglisten</h2>
              <p className="text-sm text-muted-foreground">
                Meyton nennt zu jeder Scheibe eine Rangliste des Vereins. Ordne zu, welche Wettkampf
                sind; ohne Zuordnung gilt Training. Wer eine Scheibe selbst umstellt, behält seine
                Wahl.
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
            <section className="grid gap-3 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-[15px] font-semibold">Epochen der Ablage</h2>
              {overview.sources.length ? (
                <ul className="grid gap-2">
                  {overview.sources.map((source) => (
                    <li
                      key={source.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span className="text-sm">
                        Epoche {source.epoch} · {source.snapshots} Stände
                        {source.confirmedAt
                          ? ` · bestätigt ${source.confirmedAt}`
                          : " · unbestätigt"}
                      </span>
                      {!source.confirmedAt && (
                        <ConfirmEpochButton sourceId={source.id} epoch={source.epoch} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Die erste Epoche entsteht mit dem ersten Snapshot der Brücke.
                </p>
              )}
            </section>
          </>
        )}
      </section>
    </Page>
  )
}
