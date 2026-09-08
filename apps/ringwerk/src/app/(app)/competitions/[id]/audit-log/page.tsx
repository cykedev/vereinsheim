import { notFound, redirect } from "next/navigation"
import { CalendarDays, Trophy, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getAuditLogsByCompetition } from "@/lib/auditLog/queries"
import { AuditLogList } from "@/components/app/auditLog/AuditLogList"
import {
  CompetitionDetailHeader,
  DetailNavButton,
} from "@/components/app/shell/CompetitionDetailHeader"
import { getDisplayTimeZone } from "@vereinsheim/lib/dateTime"

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

  const tz = getDisplayTimeZone()

  return (
    <div className="space-y-6">
      <CompetitionDetailHeader
        title={competition.name}
        subtitle={`${competition.discipline?.name ?? "Gemischt"} · Protokoll`}
        actions={
          <>
            <DetailNavButton
              href={`/competitions/${id}/participants`}
              label="Teilnehmer"
              icon={Users}
            />
            <DetailNavButton
              href={`/competitions/${id}/schedule`}
              label="Spielplan & Tabelle"
              icon={CalendarDays}
            />
            <DetailNavButton href={`/competitions/${id}/playoffs`} label="Playoffs" icon={Trophy} />
          </>
        }
      />

      <AuditLogList entries={entries} displayTimeZone={tz} />
    </div>
  )
}
