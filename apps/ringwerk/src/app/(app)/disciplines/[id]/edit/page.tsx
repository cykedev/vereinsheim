import { notFound, redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getDisciplineById } from "@/lib/disciplines/queries"
import { updateDiscipline } from "@/lib/disciplines/actions"
import { DisciplineForm } from "@/components/app/disciplines/DisciplineForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditDisciplinePage({ params }: Props) {
  const { id } = await params

  const [session, discipline] = await Promise.all([getAuthSession(), getDisciplineById(id)])

  if (!session || !canManage(session.user.role)) redirect("/")
  if (!discipline) notFound()

  // updateDiscipline braucht die id gebunden — partiell applizieren
  const action = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return updateDiscipline(id, prevState, formData)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Disziplin bearbeiten" />
      </div>
      <DisciplineForm discipline={discipline} action={action} />
    </div>
  )
}
