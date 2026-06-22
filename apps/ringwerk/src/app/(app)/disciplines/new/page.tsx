import { redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { createDiscipline } from "@/lib/disciplines/actions"
import { DisciplineForm } from "@/components/app/disciplines/DisciplineForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default async function NewDisciplinePage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Neue Disziplin" />
      </div>
      <DisciplineForm action={createDiscipline} />
    </div>
  )
}
