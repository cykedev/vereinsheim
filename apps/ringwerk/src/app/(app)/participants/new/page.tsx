import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { createParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "@/components/app/participants/ParticipantForm"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export const metadata: Metadata = {
  title: "Neuer Teilnehmer",
}

export default async function NewParticipantPage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Neuer Teilnehmer" />
      <ParticipantForm action={createParticipant} />
    </div>
  )
}
