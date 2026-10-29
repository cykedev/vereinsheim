import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { getDisciplineById } from "@/lib/disciplines/actions"
import { DisciplineForm } from "@/components/app/disciplines/DisciplineForm"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"
import { MovedPage } from "@/components/app/moved/MovedPage"
import { disciplineWritable } from "@/lib/moved/rules"

export const metadata: Metadata = {
  title: "Disziplin bearbeiten",
}

export default async function EditDisciplinePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const { id } = await params
  const discipline = await getDisciplineById(id)

  if (!discipline) notFound()
  const user = { moved: session.user.movedToSpiegel, isAdmin: session.user.role === "ADMIN" }
  if (!disciplineWritable(user, discipline)) return <MovedPage kind="disciplineEdit" />

  return (
    <div className="space-y-6">
      <PageHeader
        title={discipline.isSystem ? "System-Disziplin bearbeiten" : "Disziplin bearbeiten"}
        description={
          discipline.isSystem
            ? "Diese Standard-Disziplin gilt für alle Nutzer."
            : "Name, Serien und Schusszahl anpassen."
        }
      />
      <DisciplineForm initialData={discipline} disciplineId={id} />
    </div>
  )
}
