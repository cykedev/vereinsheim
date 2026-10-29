import type { Metadata } from "next"
import { getAuthSession } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Star, Target } from "lucide-react"
import {
  getDisciplinesForManagement,
  getFavouriteDisciplineId,
  getHiddenDisciplineIds,
} from "@/lib/disciplines/actions"
import { Badge } from "@vereinsheim/ui/badge"
import { Card, CardContent } from "@vereinsheim/ui/design2/card"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { CreateItemLinkButton } from "@/components/app/sessions/CreateItemLinkButton"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"
import { MOVED_TEXTS } from "@/lib/moved/texts"

const scoringTypeLabel: Record<string, string> = {
  WHOLE: "Ganzringe",
  TENTH: "Zehntelringe",
}

export const metadata: Metadata = {
  title: "Disziplinen",
}

export default async function DisciplinesPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")
  const isAdmin = session.user.role === "ADMIN"
  // Konto nach Spiegel umgezogen: Mitglieder legen nichts mehr an, ein Admin nur noch Disziplinen der Anlage
  const moved = session.user.movedToSpiegel
  const createLabel = moved
    ? isAdmin
      ? MOVED_TEXTS.newSystemDiscipline
      : null
    : isAdmin
      ? "Neue (System-)Disziplin"
      : "Neue Disziplin"

  const [disciplines, favouriteDisciplineId, hiddenIds] = await Promise.all([
    getDisciplinesForManagement(),
    getFavouriteDisciplineId(),
    getHiddenDisciplineIds(),
  ])
  const hiddenSet = new Set(hiddenIds)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disziplinen"
        description={
          isAdmin
            ? "Verwalte System- und eigene Disziplinen, setze Favoriten und archiviere bei Bedarf."
            : "Nutze System-Disziplinen, verwalte eigene Disziplinen und setze deinen Favoriten."
        }
        action={
          createLabel ? (
            <CreateItemLinkButton href="/disciplines/new" label={createLabel} />
          ) : undefined
        }
      />

      {disciplines.length === 0 ? (
        <EmptyState
          title="Noch keine Disziplinen vorhanden"
          icon={Target}
          {...(createLabel
            ? {
                description: moved ? undefined : "Lege deine erste Disziplin an.",
                actionLabel: createLabel,
                actionHref: "/disciplines/new",
              }
            : { description: MOVED_TEXTS.emptyHint })}
        />
      ) : (
        <div className="space-y-2">
          {disciplines.map((d) => (
            // Übersicht konsistent zu anderen Bereichen:
            // komplette Karte öffnet die Detailansicht mit allen Aktionen.
            <Link key={d.id} href={`/disciplines/${d.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/30">
                <CardContent>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      {/* Favorit in der Übersicht direkt sichtbar halten —
                          so muss die Detailansicht nicht erst geöffnet werden. */}
                      {favouriteDisciplineId === d.id && (
                        <Star className="h-3.5 w-3.5 shrink-0 text-warning" fill="currentColor" />
                      )}
                      <span className="break-words font-medium">{d.name}</span>
                      {d.isSystem && (
                        <Badge variant="secondary" className="text-xs">
                          Standard
                        </Badge>
                      )}
                      {d.isArchived && (
                        <Badge variant="outline" className="text-xs">
                          Archiviert
                        </Badge>
                      )}
                      {hiddenSet.has(d.id) && (
                        <Badge variant="outline" className="text-xs">
                          Ausgeblendet
                        </Badge>
                      )}
                    </div>
                    <p className="break-words text-sm text-muted-foreground">
                      {d.seriesCount} × {d.shotsPerSeries} Schuss —{" "}
                      {scoringTypeLabel[d.scoringType] ?? d.scoringType}
                      {d.practiceSeries > 0 && ` — ${d.practiceSeries} Probe-Serie(n)`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
