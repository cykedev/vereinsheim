import { redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { createParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "@/components/app/participants/ParticipantForm"
import { PageHeader } from "@/components/app/shell/PageHeader"

export default async function NewParticipantPage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <PageHeader title="Neuer Teilnehmer" />
      </div>
      <ParticipantForm action={createParticipant} />
    </div>
  )
}
