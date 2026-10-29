import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { CheckCircle2, Gauge, Target } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import {
  getDisciplineForDetail,
  getDisciplineUsage,
  getFavouriteDisciplineId,
  getHiddenDisciplineIds,
} from "@/lib/disciplines/actions"
import { DisciplineDetailActions } from "@/components/app/disciplines/DisciplineDetailActions"
import { Badge } from "@vereinsheim/ui/badge"
import { Card, CardContent } from "@vereinsheim/ui/design2/card"
import { Separator } from "@vereinsheim/ui/separator"
import { disciplineWritable } from "@/lib/moved/rules"

const scoringTypeLabel: Record<string, string> = {
  WHOLE: "Ganzringe",
  TENTH: "Zehntelringe",
}

export const metadata: Metadata = {
  title: "Disziplin",
}

export default async function DisciplineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const { id } = await params
  const [discipline, favouriteDisciplineId, hiddenIds] = await Promise.all([
    getDisciplineForDetail(id),
    getFavouriteDisciplineId(),
    getHiddenDisciplineIds(),
  ])
  const isHidden = hiddenIds.includes(id)

  if (!discipline) notFound()

  // Konto nach Spiegel umgezogen: keine Einstellungen des Kontos mehr, ändern nur ein Admin an der Disziplin der Anlage
  const moved = session.user.movedToSpiegel
  const canManage =
    (!discipline.isSystem || session.user.role === "ADMIN") &&
    disciplineWritable({ moved, isAdmin: session.user.role === "ADMIN" }, discipline)
  const usage = canManage ? await getDisciplineUsage(discipline.id) : null
  const canDelete = usage?.canDelete ?? false

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-end">
          <DisciplineDetailActions
            discipline={discipline}
            moved={moved}
            canManage={canManage}
            canDelete={canDelete}
            favourite={favouriteDisciplineId === discipline.id}
            hidden={isHidden}
          />
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words font-display text-[1.7rem] leading-tight font-bold tracking-tight">
              {discipline.name}
            </h1>
            {discipline.isSystem && <Badge variant="secondary">Standard</Badge>}
            {discipline.isArchived && <Badge variant="outline">Archiviert</Badge>}
            {isHidden && <Badge variant="outline">Ausgeblendet</Badge>}
          </div>
          <p className="text-muted-foreground">
            {discipline.isSystem
              ? "System-Disziplin für alle Nutzer."
              : "Eigene Disziplin für dein Training."}
          </p>
        </div>
      </div>

      <Separator />

      {/* Keine zusätzliche umschließende Card:
          reduziert doppelte Rahmen und macht den Block ruhiger. */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Konfiguration</h2>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/60 bg-card/70">
            <CardContent className="space-y-1.5 p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                Serien
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {discipline.seriesCount}
              </p>
              <p className="text-sm text-muted-foreground">Wertungsserien pro Einheit</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardContent className="space-y-1.5 p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Schuss pro Serie
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {discipline.shotsPerSeries}
              </p>
              <p className="text-sm text-muted-foreground">Standard pro Serie</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardContent className="space-y-1.5 p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                Probe-Serien
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {discipline.practiceSeries}
              </p>
              <p className="text-sm text-muted-foreground">Vor der Wertung</p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardContent className="space-y-1.5 p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Gauge className="h-4 w-4" />
                Wertungsart
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {scoringTypeLabel[discipline.scoringType] ?? discipline.scoringType}
              </p>
              <p className="text-sm text-muted-foreground">
                {discipline.scoringType === "TENTH" ? "0.0 bis 10.9" : "0 bis 10"}
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          {discipline.isSystem
            ? "Diese Standard-Disziplin wird zentral verwaltet und kann von allen Nutzern verwendet werden."
            : "Diese Disziplin gehört deinem Konto und kann unabhängig von System-Disziplinen angepasst werden."}
        </p>
        {canManage && !canDelete && (
          <p className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Endgültiges Löschen ist erst möglich, wenn die Disziplin nicht mehr in Einheiten oder
            Abläufen verwendet wird.
          </p>
        )}
      </div>
    </div>
  )
}
