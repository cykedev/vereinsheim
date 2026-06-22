import Link from "next/link"
import { CalendarDays, Trophy, Users, BarChart2, ListOrdered, CalendarCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CompetitionActions } from "@/components/app/competitions/CompetitionActions"
import { formatDateOnly } from "@/lib/dateTime"
import type { CompetitionListItem } from "@/lib/competitions/types"

function formatDate(date: Date | null, tz: string): string {
  if (!date) return "—"
  return formatDateOnly(date, tz)
}

const NAV_LINK =
  "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"

function CardLinks({ c, canManage }: { c: CompetitionListItem; canManage: boolean }) {
  if (c.type === "EVENT" || c.type === "SEASON") {
    const rankingHref = c.type === "EVENT" ? "ranking" : "standings"
    return (
      <>
        {canManage && (
          <Link href={`/competitions/${c.id}/participants`} className={NAV_LINK}>
            <Users className="h-3.5 w-3.5" />
            {c._count.participants} Teilnehmer
          </Link>
        )}
        {canManage && (
          <Link href={`/competitions/${c.id}/series`} className={NAV_LINK}>
            <ListOrdered className="h-3.5 w-3.5" />
            Serien
          </Link>
        )}
        <Link href={`/competitions/${c.id}/${rankingHref}`} className={NAV_LINK}>
          <BarChart2 className="h-3.5 w-3.5" />
          Rangliste
        </Link>
      </>
    )
  }
  // LEAGUE (default)
  return (
    <>
      {canManage && (
        <Link href={`/competitions/${c.id}/participants`} className={NAV_LINK}>
          <Users className="h-3.5 w-3.5" />
          {c._count.participants} Teilnehmer
        </Link>
      )}
      <Link href={`/competitions/${c.id}/schedule`} className={NAV_LINK}>
        <CalendarDays className="h-3.5 w-3.5" />
        Spielplan & Tabelle
      </Link>
      <Link href={`/competitions/${c.id}/playoffs`} className={NAV_LINK}>
        <Trophy className="h-3.5 w-3.5" />
        Playoffs
      </Link>
    </>
  )
}

function CardMeta({ c, tz }: { c: CompetitionListItem; tz: string }) {
  if (c.type === "EVENT") {
    if (!c.eventDate) return null
    return (
      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
        <CalendarCheck className="h-3 w-3" />
        {formatDate(c.eventDate, tz)}
      </p>
    )
  }
  if (c.type === "SEASON") {
    if (!c.seasonStart) return null
    return (
      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
        <CalendarCheck className="h-3 w-3" />
        {formatDate(c.seasonStart, tz)}
        {c.seasonEnd && <> – {formatDate(c.seasonEnd, tz)}</>}
      </p>
    )
  }
  // BEST_OF_SINGLE hat keine Hin-/Rückrunde — der einzelne Vergleich wird individuell vereinbart.
  if (c.leagueFormat === "BEST_OF_SINGLE") return null
  return (
    <p className="text-xs text-muted-foreground/70">
      Hinrunde bis {formatDate(c.hinrundeDeadline, tz)} · Rückrunde bis{" "}
      {formatDate(c.rueckrundeDeadline, tz)}
    </p>
  )
}

function TypeBadge({ type }: { type: string }) {
  if (type === "EVENT")
    return (
      <Badge variant="outline" className="text-xs">
        Event
      </Badge>
    )
  if (type === "SEASON")
    return (
      <Badge variant="outline" className="text-xs">
        Saison
      </Badge>
    )
  return null
}

interface Props {
  competition: CompetitionListItem
  canManage: boolean
  tz: string
  showMeta?: boolean
  cardClassName?: string
}

// Einheitliche Wettbewerbskarte. Der Name verlinkt auf die kanonische Detailseite;
// die Karte selbst ist nicht ganz klickbar (Multi-Ziel-Objekt — siehe Spec P1.3).
export function CompetitionListCard({
  competition: c,
  canManage,
  tz,
  showMeta = false,
  cardClassName,
}: Props) {
  return (
    <Card className={cardClassName ?? "transition-colors hover:bg-muted/20"}>
      <CardContent className="space-y-3 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/competitions/${c.id}`} className="text-base font-semibold hover:underline">
            {c.name}
          </Link>
          <TypeBadge type={c.type} />
          <Badge variant="secondary" className="text-xs">
            {c.discipline ? c.discipline.name : "Gemischt"}
          </Badge>
          {c.isPublic && (
            <Badge variant="outline" className="text-xs">
              Öffentlich
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <CardLinks c={c} canManage={canManage} />
        </div>
        {showMeta && <CardMeta c={c} tz={tz} />}
        {canManage && (
          <div className="flex justify-end border-t border-border/50 pt-3">
            <CompetitionActions competition={c} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
