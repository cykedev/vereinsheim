import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Archive, Target } from "lucide-react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getDisciplinesForManagement } from "@/lib/disciplines/queries"
import { DisciplineActions } from "@/components/app/disciplines/DisciplineActions"
import { Button } from "@vereinsheim/ui/button"
import { Badge } from "@vereinsheim/ui/badge"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default async function DisciplinesPage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  const disciplines = await getDisciplinesForManagement()

  const active = disciplines.filter((d) => !d.isArchived)
  const archived = disciplines.filter((d) => d.isArchived)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader
        title="Disziplinen"
        description="Wettbewerbsdisziplinen des Vereins"
        action={
          <Button asChild size="sm">
            <Link href="/disciplines/new">
              <Plus className="mr-1 h-4 w-4" />
              Neue Disziplin
            </Link>
          </Button>
        }
      />

      {/* Aktive Disziplinen */}
      {active.length === 0 ? (
        <EmptyState
          title="Keine Disziplinen vorhanden."
          description="Lege deine erste Disziplin an."
          icon={Target}
          actionLabel="Neue Disziplin"
          actionHref="/disciplines/new"
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {active.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-sm font-medium">{d.name}</span>
                    {d.isSystem && (
                      <span className="ml-2 text-xs text-muted-foreground">(System)</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {d.scoringType === "WHOLE" ? "Ganzringe" : "Zehntelringe"}
                  </Badge>
                </div>
                <DisciplineActions discipline={d} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archivierte Disziplinen */}
      {archived.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Archiviert ({archived.length})
          </div>
          <div className="rounded-lg border bg-card opacity-60">
            <div className="divide-y">
              {archived.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm line-through">{d.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {d.scoringType === "WHOLE" ? "Ganzringe" : "Zehntelringe"}
                    </Badge>
                  </div>
                  <DisciplineActions discipline={d} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
