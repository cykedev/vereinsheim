"use client"

import { useState, useTransition } from "react"
import { CheckCircle, Archive, ArchiveRestore, RotateCcw } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vereinsheim/ui/alert-dialog"
import { toast } from "sonner"
import { setCompetitionStatus } from "@/lib/competitions/actions"
import type { CompetitionListItem } from "@/lib/competitions/types"
import type { CompetitionStatus } from "@/generated/prisma/client"

interface Props {
  competition: CompetitionListItem
  disabled?: boolean
}

interface PendingStatus {
  status: CompetitionStatus
  label: string
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
          onClick={() =>
            setPendingStatus({ status: "COMPLETED", label: "als abgeschlossen markieren" })
          }
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
            onClick={() => setPendingStatus({ status: "ACTIVE", label: "wieder öffnen" })}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            title="Archivieren"
            aria-label="Archivieren"
            onClick={() => setPendingStatus({ status: "ARCHIVED", label: "archivieren" })}
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
          onClick={() =>
            setPendingStatus({
              status: "COMPLETED",
              label: "wiederherstellen (als abgeschlossen)",
            })
          }
        >
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      )}

      {/* Status-Änderung bestätigen */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wettbewerb {pendingStatus?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Wettbewerb „${competition.name}" wird ${pendingStatus?.label}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
