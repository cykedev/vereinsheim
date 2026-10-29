import type { Metadata } from "next"
import { getAuthSession } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import { DisciplineForm } from "@/components/app/disciplines/DisciplineForm"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"
import { MovedPage } from "@/components/app/moved/MovedPage"
import { MOVED_TEXTS } from "@/lib/moved/texts"

export const metadata: Metadata = {
  title: "Neue Disziplin",
}

export default async function NewDisciplinePage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const isAdmin = session.user.role === "ADMIN"
  // Konto nach Spiegel umgezogen: eigene Disziplinen gehen in Spiegel, ein Admin pflegt weiter die der Anlage
  const moved = session.user.movedToSpiegel
  if (moved && !isAdmin) return <MovedPage kind="disciplineNew" />

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          moved
            ? MOVED_TEXTS.newSystemDiscipline
            : isAdmin
              ? "Neue Disziplin anlegen"
              : "Neue Disziplin"
        }
        description={
          moved
            ? undefined
            : isAdmin
              ? "Als Admin kannst du System-Disziplinen für alle oder eigene Disziplinen anlegen."
              : "Eigene Disziplin mit individuellem Format anlegen."
        }
      />
      <DisciplineForm canCreateSystem={isAdmin} systemOnly={moved} />
    </div>
  )
}
