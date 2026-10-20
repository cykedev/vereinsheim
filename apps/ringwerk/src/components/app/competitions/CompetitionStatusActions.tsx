"use client"

import { useState, useTransition } from "react"
import { CheckCircle, Archive, ArchiveRestore, RotateCcw } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { toast } from "sonner"
import { competitionStatus, type StatusChange } from "@/lib/consequences"
import { setCompetitionStatus } from "@/lib/competitions/actions"
import type { CompetitionListItem } from "@/lib/competitions/types"
import type { CompetitionStatus } from "@/generated/prisma/client"

interface Props {
  competition: CompetitionListItem
  disabled?: boolean
}

interface PendingStatus {
  status: CompetitionStatus
  change: StatusChange
}

// Status-Wechsel-Buttons (fachliche Aktionen) inkl. Bestätigungsdialog für einen Wettbewerb.
export function CompetitionStatusActions({ competition, disabled = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null)

  function handleStatusChange() {
    if (!pendingStatus) return
    startTransition(async () => {
      const result = await setCompetitionStatus(competition.id, pendingStatus.status)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      } else {
        toast.success("Status geändert.")
      }
      setPendingStatus(null)
    })
  }

  const busy = disabled || isPending

  return (
    <>
      {competition.status === "ACTIVE" && (
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          title="Als abgeschlossen markieren"
          aria-label="Als abgeschlossen markieren"
          onClick={() => setPendingStatus({ status: "COMPLETED", change: "complete" })}
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      )}

      {competition.status === "COMPLETED" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            title="Wieder öffnen"
            aria-label="Wieder öffnen"
            onClick={() => setPendingStatus({ status: "ACTIVE", change: "reopen" })}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            title="Archivieren"
            aria-label="Archivieren"
            onClick={() => setPendingStatus({ status: "ARCHIVED", change: "archive" })}
          >
            <Archive className="h-4 w-4" />
          </Button>
        </>
      )}

      {competition.status === "ARCHIVED" && (
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          title="Wiederherstellen"
          aria-label="Wiederherstellen"
          onClick={() => setPendingStatus({ status: "COMPLETED", change: "restore" })}
        >
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      )}

      {/* Status-Änderung bestätigen */}
      <DecisionDialog
        decision={competitionStatus(pendingStatus?.change ?? "complete", {
          name: competition.name,
          publicSlug: competition.isPublic ? competition.publicSlug : null,
        })}
        open={!!pendingStatus}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        onConfirm={handleStatusChange}
      />
    </>
  )
}
