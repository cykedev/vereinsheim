import { redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getDisciplines } from "@/lib/disciplines/queries"
import { createCompetition } from "@/lib/competitions/actions"
import { CompetitionForm } from "@/components/app/competitions/CompetitionForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default async function NewCompetitionPage() {
  const [session, disciplines] = await Promise.all([getAuthSession(), getDisciplines()])
  if (!session || !canManage(session.user.role)) redirect("/")

  if (disciplines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-4">
          <PageHeader title="Neuer Wettbewerb" />
        </div>
        <p className="text-sm text-muted-foreground">
          Es sind keine Disziplinen vorhanden. Bitte zuerst eine Disziplin anlegen.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Neuer Wettbewerb" />
      </div>
      <CompetitionForm action={createCompetition} disciplines={disciplines} />
    </div>
  )
}
