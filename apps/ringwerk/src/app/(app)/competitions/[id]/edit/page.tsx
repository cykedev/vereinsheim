import { notFound, redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getDisciplines } from "@/lib/disciplines/queries"
import { getCompetitionById } from "@/lib/competitions/queries"
import { hasPlayoffsStarted } from "@/lib/playoffs/queries"
import { updateCompetition } from "@/lib/competitions/actions"
import { CompetitionForm } from "@/components/app/competitions/CompetitionForm"
import { ForceDeleteCompetitionSection } from "@/components/app/competitions/ForceDeleteCompetitionSection"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCompetitionPage({ params }: Props) {
  const { id } = await params

  const [session, competition, disciplines, playoffsStarted] = await Promise.all([
    getAuthSession(),
    getCompetitionById(id),
    getDisciplines(),
    hasPlayoffsStarted(id),
  ])

  if (!session || !canManage(session.user.role)) redirect("/")
  if (!competition) notFound()

  const hasMatchups = competition._count.matchups > 0

  const action = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return updateCompetition(id, prevState, formData)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Wettbewerb bearbeiten" />
      </div>
      <CompetitionForm
        competition={competition}
        disciplines={disciplines}
        action={action}
        hasMatchups={hasMatchups}
        playoffsStarted={playoffsStarted}
      />
      <div className="mt-12">
        <ForceDeleteCompetitionSection competitionId={id} competitionName={competition.name} />
      </div>
    </div>
  )
}
