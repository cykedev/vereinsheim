import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"
import { ShotRoutineEditor } from "@/components/app/shot-routines/ShotRoutineEditor"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"
import { MovedPage } from "@/components/app/moved/MovedPage"

export const metadata: Metadata = {
  title: "Neuer Ablauf",
}

export default async function NeuerShotRoutinesPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")
  if (session.user.movedToSpiegel) return <MovedPage kind="routineNew" />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neuer Schuss-Ablauf"
        description="Beschreibe die Schritte deines idealen Schuss-Ablaufs."
      />
      <ShotRoutineEditor />
    </div>
  )
}
