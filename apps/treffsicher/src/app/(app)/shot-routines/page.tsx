import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ListChecks } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { formatDateOnly, getDisplayTimeZone } from "@vereinsheim/lib/dateTime"
import { getShotRoutines } from "@/lib/shot-routines/actions"
import type { RoutineStep } from "@/lib/shot-routines/actions"
import { MOVED_TEXTS } from "@/lib/moved/texts"
import { CreateItemLinkButton } from "@/components/app/sessions/CreateItemLinkButton"
import { PageHeader } from "@vereinsheim/ui/design2/page-header"
import { Card, CardContent } from "@vereinsheim/ui/design2/card"
import { EmptyState } from "@vereinsheim/ui/empty-state"

export const metadata: Metadata = {
  title: "Schuss-Abläufe",
}

export default async function ShotRoutinesPage() {
  const displayTimeZone = getDisplayTimeZone()
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const readOnly = session.user.movedToSpiegel
  const routines = await getShotRoutines()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schuss-Abläufe"
        // umgezogen: kein Satz, der Anlegen und Bearbeiten anbietet; der Hinweis darüber sagt, wo das jetzt geht
        description={
          readOnly ? undefined : "Lege Abläufe mit ihren Schritten an und verfeinere sie laufend."
        }
        action={
          readOnly ? undefined : (
            <CreateItemLinkButton href="/shot-routines/new" label="Neuer Ablauf" />
          )
        }
      />

      {routines.length === 0 ? (
        <EmptyState
          title="Noch kein Ablauf vorhanden"
          icon={ListChecks}
          {...(readOnly
            ? { description: MOVED_TEXTS.emptyHint }
            : {
                description: "Erstelle deinen ersten Schuss-Ablauf.",
                actionLabel: "Neuer Ablauf",
                actionHref: "/shot-routines/new",
              })}
        />
      ) : (
        <div className="space-y-2">
          {routines.map((r) => {
            const steps: RoutineStep[] = Array.isArray(r.steps) ? (r.steps as RoutineStep[]) : []
            const stepCountText = `${steps.length} ${steps.length === 1 ? "Schritt" : "Schritte"}`
            return (
              // Ganze Karte klickbar statt separatem Detail-Button:
              // das entspricht dem Tagebuch-Flow und reduziert einen unnötigen Extra-Schritt.
              <Link key={r.id} href={`/shot-routines/${r.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent>
                    <div className="min-w-0 space-y-0.5">
                      <p className="break-words font-medium">{r.name}</p>
                      <p className="break-words text-sm text-muted-foreground">
                        {stepCountText} · Zuletzt geändert am{" "}
                        {formatDateOnly(r.updatedAt, displayTimeZone)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
