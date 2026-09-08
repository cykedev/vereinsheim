import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getParticipantById } from "@/lib/participants/queries"
import { updateParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "@/components/app/participants/ParticipantForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Teilnehmer bearbeiten",
}

export default async function EditParticipantPage({ params }: Props) {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  const { id } = await params
  const participant = await getParticipantById(id)
  if (!participant) notFound()

  const action = updateParticipant.bind(null, id)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Teilnehmer bearbeiten" />
      <ParticipantForm participant={participant} action={action} />
    </div>
  )
}
