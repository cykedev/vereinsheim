import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { BookOpen, Goal } from "lucide-react"

import { formatDateOnly, getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { Badge } from "@vereinsheim/ui/badge"
import { Button } from "@vereinsheim/ui/button"
import { Card, CardContent } from "@vereinsheim/ui/card"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

import { getAuthSession } from "@/lib/auth-helpers"
import { selectDashboardData } from "@/lib/dashboard/selectDashboardData"
import { getGoalsWithAssignments } from "@/lib/goals/actions"
import { getSessions } from "@/lib/sessions/actions"
import { GOAL_TYPE_LABELS } from "@/components/app/goals/goal-card-section/format"
import { CreateItemLinkButton } from "@/components/app/sessions/CreateItemLinkButton"
import { SessionsList } from "@/components/app/sessions/list/SessionsList"

export const metadata: Metadata = {
  title: "Dashboard",
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

// Dashboard-Seite: Einstiegspunkt nach dem Login. Zeigt den eigenen Stand
// (letzte Einheiten, laufende Ziele, zwei Kennzahlen) statt die Navigation zu
// wiederholen.
export default async function DashboardPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const displayTimeZone = getDisplayTimeZone()
  const displayName = session.user.name ?? session.user.email

  const [sessions, goals] = await Promise.all([getSessions(), getGoalsWithAssignments()])
  const { recentSessions, activeGoals, sessionsLast30Days, sessionsTotal } = selectDashboardData(
    sessions,
    goals,
    new Date()
  )

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Willkommen, ${displayName}`}
        action={<CreateItemLinkButton href="/sessions/new" label="Neue Einheit" />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Einheiten in den letzten 30 Tagen" value={sessionsLast30Days} />
        <StatCard label="Einheiten gesamt" value={sessionsTotal} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Letzte Einheiten</h2>
        {recentSessions.length === 0 ? (
          <EmptyState
            title="Noch keine Einheiten vorhanden"
            description="Starte mit deiner ersten Einheit."
            icon={BookOpen}
            actionLabel="Neue Einheit"
            actionHref="/sessions/new"
          />
        ) : (
          <>
            <SessionsList sessions={recentSessions} displayTimeZone={displayTimeZone} />
            <div className="flex justify-end">
              <Button asChild variant="link" className="px-0">
                <Link href="/sessions">Alle Einheiten</Link>
              </Button>
            </div>
          </>
        )}
      </section>

      {activeGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Laufende Ziele</h2>
          <div className="space-y-2">
            {activeGoals.map((goal) => (
              // Ganze Karte klickbar wie in den Übersichtslisten.
              <Link key={goal.id} href={`/goals/${goal.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="space-y-2 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Goal className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="break-words font-medium">{goal.title}</p>
                      <Badge variant="outline">{GOAL_TYPE_LABELS[goal.type] ?? goal.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Bis {formatDateOnly(new Date(goal.dateTo), displayTimeZone)} ·{" "}
                      {goal.sessionCount} Einheit{goal.sessionCount === 1 ? "" : "en"} zugeordnet
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="flex justify-end">
            <Button asChild variant="link" className="px-0">
              <Link href="/goals">Alle Ziele</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
