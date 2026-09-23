import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Trophy } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionsForManagement } from "@/lib/competitions/queries"
import { loadCompetitionPreview } from "@/lib/competitions/preview"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"
import { DashboardCompetitionCard } from "@/components/app/dashboard/DashboardCompetitionCard"

// Reihenfolge der Karten: erst Ligen (Tabelle / Playoffs), dann Events, dann Saisons.
const TYPE_ORDER = ["LEAGUE", "EVENT", "SEASON"] as const

// ─── DashboardPage ───────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const competitions = await getCompetitionsForManagement()
  const active = competitions.filter((c) => c.status === "ACTIVE")
  const previews = await Promise.all(
    TYPE_ORDER.flatMap((type) => active.filter((c) => c.type === type)).map(loadCompetitionPreview)
  )

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Aktive Wettbewerbe auf einen Blick" />

      {active.length === 0 ? (
        <EmptyState
          title="Keine aktiven Wettbewerbe"
          description="Aktive Wettbewerbe erscheinen hier mit Tabelle bzw. Rangliste."
          icon={Trophy}
        />
      ) : (
        <div className="space-y-4">
          {previews.map((preview) => (
            <DashboardCompetitionCard key={preview.competition.id} preview={preview} />
          ))}
        </div>
      )}
    </div>
  )
}
