"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog, type Decision } from "@vereinsheim/ui/design2/decision-dialog"
import { toast } from "sonner"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { setDisciplineArchived } from "@/lib/disciplines/actions"

interface Props {
  disciplineId: string
  isArchived: boolean
  /** die Folgen in Worten (`disciplineArchive` bzw. `disciplineActivate`), von der Seite berechnet */
  decision: Decision
}

// Schaltet den Archiv-Status einer Disziplin um. Standarddisziplinen schaltet nur ein Admin um.
export function ArchiveDisciplineButton({ disciplineId, isArchived, decision }: Props) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const nextArchived = !isArchived
  const label = isArchived ? "Aktivieren" : "Archivieren"

  function handleToggleArchive(): void {
    startTransition(async () => {
      const result = await setDisciplineArchived(disciplineId, nextArchived)
      setOpen(false)
      // etwa ein Konto, das nach Spiegel umgezogen ist, während die Seite offen war
      const error = getErrorMessage(result)
      if (error) toast.error(error)
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="px-2 sm:px-3"
        disabled={isPending}
        aria-label={nextArchived ? "Disziplin archivieren" : "Disziplin aktivieren"}
        onClick={() => setOpen(true)}
      >
        {isArchived ? (
          <ArchiveRestore className="h-4 w-4 sm:mr-1.5" />
        ) : (
          <Archive className="h-4 w-4 sm:mr-1.5" />
        )}
        <span className="hidden sm:inline">{isPending ? "…" : label}</span>
      </Button>
      <DecisionDialog
        decision={decision}
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleToggleArchive}
      />
    </>
  )
}
