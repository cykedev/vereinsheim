import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Users } from "lucide-react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getParticipantsForManagement } from "@/lib/participants/queries"
import { ParticipantRowActions } from "@/components/app/participants/ParticipantRowActions"
import { Button } from "@vereinsheim/ui/button"
import { Badge } from "@vereinsheim/ui/badge"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { PageHeader } from "@vereinsheim/ui/shell/PageHeader"

export default async function ParticipantsPage() {
  const session = await getAuthSession()
  if (!session || !canManage(session.user.role)) redirect("/")

  const participants = await getParticipantsForManagement()
  const active = participants.filter((p) => p.isActive)
  const inactive = participants.filter((p) => !p.isActive)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader
        title="Teilnehmer"
        description="Alle Schützen des Vereins"
        action={
          <div className="flex items-center gap-2">
            <PdfDownloadButton href="/api/participants/pdf" label="Teilnehmerliste drucken" />
            <Button asChild size="sm">
              <Link href="/participants/new">
                <Plus className="mr-1 h-4 w-4" />
                Neuer Teilnehmer
              </Link>
            </Button>
          </div>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          title="Keine aktiven Teilnehmer vorhanden."
          description="Lege deinen ersten Teilnehmer an."
          icon={Users}
          actionLabel="Neuer Teilnehmer"
          actionHref="/participants/new"
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {active.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/participants/${p.id}/edit`}
                      className="text-sm font-medium hover:underline"
                    >
                      {p.lastName}, {p.firstName}
                    </Link>
                    {p._count.competitions > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {p._count.competitions}{" "}
                        {p._count.competitions === 1 ? "Wettbewerb" : "Wettbewerbe"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.contact}</p>
                </div>
                <ParticipantRowActions
                  participantId={p.id}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  contact={p.contact}
                  isActive={p.isActive}
                  isAdmin={session.user.role === "ADMIN"}
                  competitionsCount={p._count.competitions}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {inactive.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Inaktiv ({inactive.length})</p>
          <div className="rounded-lg border bg-card opacity-60">
            <div className="divide-y">
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm line-through text-muted-foreground">
                      {p.lastName}, {p.firstName}
                    </span>
                    <p className="text-xs text-muted-foreground">{p.contact}</p>
                  </div>
                  <ParticipantRowActions
                    participantId={p.id}
                    firstName={p.firstName}
                    lastName={p.lastName}
                    contact={p.contact}
                    isActive={p.isActive}
                    isAdmin={session.user.role === "ADMIN"}
                    competitionsCount={p._count.competitions}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
