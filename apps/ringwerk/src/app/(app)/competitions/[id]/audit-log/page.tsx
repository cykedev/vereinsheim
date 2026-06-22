import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, Trophy, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getAuditLogsByCompetition } from "@/lib/auditLog/queries"
import { AuditLogList } from "@/components/app/auditLog/AuditLogList"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function CompetitionAuditLogPage({ params }: Props) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect(`/competitions/${id}/schedule`)

  const [competition, entries] = await Promise.all([
    getCompetitionById(id),
    getAuditLogsByCompetition(id),
  ])

  if (!competition) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/competitions">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Wettbewerbe
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{competition.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {competition.discipline?.name} · Protokoll
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/participants`} title="Teilnehmer">
                <Users className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/schedule`} title="Spielplan & Tabelle">
                <CalendarDays className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/competitions/${id}/playoffs`} title="Playoffs">
                <Trophy className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <AuditLogList entries={entries} />
    </div>
  )
}
