import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@vereinsheim/ui/design2/page-header"

import { StatisticsScreen } from "@/components/app/statistics/StatisticsScreen"
import { getAuthSession } from "@/lib/auth-helpers"
import { loadStatisticsPage } from "@/lib/statistics/load"

export const metadata: Metadata = {
  title: "Statistik",
}

/** die Abfrage der Adresse als `URLSearchParams`; mehrfache Schlüssel zählen mit ihrem ersten Wert */
function searchOf(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first !== undefined) search.set(key, first)
  }
  return search
}

// Statistik: die Seite eines Zeitraums über die Einheiten einer Disziplin. Filter stehen in der Adresse; gerechnet wird
// hier auf dem Server (`statisticsPage`), der Browser bekommt das leichte Modell.
export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getAuthSession()
  if (!session) redirect("/login")
  const { page, timeZone } = await loadStatisticsPage(session.user.id, searchOf(await searchParams))
  if (!page) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Statistik" />
        <p className="rounded-2xl border border-border bg-card p-4 text-[14px] text-foreground-2">
          Noch keine Einheit mit Ergebnis. Trag eine Einheit mit Disziplin und Serien ein. Dann
          steht hier dein Verlauf.
        </p>
      </div>
    )
  }
  return (
    <StatisticsScreen
      model={page.model}
      state={page.state}
      options={page.options}
      timeZone={timeZone}
    />
  )
}
