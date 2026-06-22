import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Archive, CheckCircle, Trophy } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionsForManagement } from "@/lib/competitions/queries"
import { getDisciplinesForManagement } from "@/lib/disciplines/queries"
import { CompetitionListCard } from "@/components/app/competitions/CompetitionListCard"
import { CompetitionsFilters } from "@/components/app/competitions/CompetitionsFilters"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/app/shell/PageHeader"
import { getDisplayTimeZone } from "@/lib/dateTime"
import type { CompetitionListItem } from "@/lib/competitions/types"

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Entwurf" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "ARCHIVED", label: "Archiviert" },
]

const TYPE_OPTIONS = [
  { value: "LEAGUE", label: "Liga" },
  { value: "EVENT", label: "Event" },
  { value: "SEASON", label: "Saison" },
]

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string; discipline?: string }>
}

function matchesFilters(
  c: CompetitionListItem,
  status: string,
  type: string,
  discipline: string
): boolean {
  if (status !== "all" && c.status !== status) return false
  if (type !== "all" && c.type !== type) return false
  if (discipline !== "all") {
    if (discipline === "mixed") return c.discipline === null
    if (c.discipline?.id !== discipline) return false
  }
  return true
}

export default async function CompetitionsPage({ searchParams }: PageProps) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const canManage = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const tz = getDisplayTimeZone()
  const { status = "all", type = "all", discipline = "all" } = await searchParams
  const all = await getCompetitionsForManagement()
  const disciplines = await getDisciplinesForManagement()

  const disciplineOptions = [
    { value: "mixed", label: "Gemischt" },
    ...disciplines.map((d) => ({ value: d.id, label: d.name })),
  ]

  const filtered = all.filter((c) => matchesFilters(c, status, type, discipline))

  const draft = filtered.filter((c) => c.status === "DRAFT")
  const active = filtered.filter((c) => c.status === "ACTIVE")
  const completed = filtered.filter((c) => c.status === "COMPLETED")
  const archived = filtered.filter((c) => c.status === "ARCHIVED")

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader
        title="Wettbewerbe"
        description={`${filtered.length} von ${all.length} Wettbewerben`}
        action={
          canManage && (
            <Button asChild size="sm">
              <Link href="/competitions/new">
                <Plus className="mr-1 h-4 w-4" />
                Neuer Wettbewerb
              </Link>
            </Button>
          )
        }
      />

      <CompetitionsFilters
        statusOptions={STATUS_OPTIONS}
        typeOptions={TYPE_OPTIONS}
        disciplineOptions={disciplineOptions}
        selectedStatus={status}
        selectedType={type}
        selectedDiscipline={discipline}
      />

      {filtered.length === 0 && (
        <EmptyState
          title="Keine Wettbewerbe für die gewählten Filter."
          icon={Trophy}
          actionLabel={canManage && all.length === 0 ? "Neuer Wettbewerb" : undefined}
          actionHref={canManage && all.length === 0 ? "/competitions/new" : undefined}
        />
      )}

      {/* Entwurf-Wettbewerbe */}
      {draft.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Entwurf ({draft.length})</p>
          {draft.map((c) => (
            <CompetitionListCard
              key={c.id}
              competition={c}
              canManage={canManage}
              tz={tz}
              cardClassName="transition-colors hover:bg-muted/20 opacity-80"
            />
          ))}
        </div>
      )}

      {/* Aktive Wettbewerbe */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((c) => (
            <CompetitionListCard
              key={c.id}
              competition={c}
              canManage={canManage}
              tz={tz}
              showMeta
            />
          ))}
        </div>
      )}

      {/* Abgeschlossene Wettbewerbe */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            Abgeschlossen ({completed.length})
          </div>
          <div className="space-y-2 opacity-70">
            {completed.map((c) => (
              <CompetitionListCard key={c.id} competition={c} canManage={canManage} tz={tz} />
            ))}
          </div>
        </div>
      )}

      {/* Archivierte Wettbewerbe */}
      {archived.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Archiviert ({archived.length})
          </div>
          <div className="space-y-2 opacity-50">
            {archived.map((c) => (
              <CompetitionListCard key={c.id} competition={c} canManage={canManage} tz={tz} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
