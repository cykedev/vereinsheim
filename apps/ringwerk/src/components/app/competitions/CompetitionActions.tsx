"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, ScrollText, Trash2 } from "lucide-react"
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
import { deleteCompetition } from "@/lib/competitions/actions"
import { DetailActionBar } from "@vereinsheim/ui/shell/DetailActionBar"
import { CompetitionStatusActions } from "@/components/app/competitions/CompetitionStatusActions"
import type { CompetitionListItem } from "@/lib/competitions/types"

interface Props {
  competition: CompetitionListItem
  // Optionaler Zurück-Link (nur auf Detailseiten; in Listenkarten weggelassen).
  backHref?: string
}

// Einheitliche Aktionsleiste für einen Wettbewerb: Inline-ghost-Buttons in der DetailActionBar.
// Reihenfolge: fachlich/sekundär → destruktiv → Zurück.
export function CompetitionActions({ competition, backHref }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCompetition(competition.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        toast.success("Wettbewerb gelöscht.")
      }
      setDeleteOpen(false)
    })
  }

  return (
    <>
      <DetailActionBar>
        {/* Fachlich/sekundär */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          title="Protokoll"
          aria-label="Protokoll"
          onClick={() => router.push(`/competitions/${competition.id}/audit-log`)}
        >
          <ScrollText className="h-4 w-4" />
        </Button>

        {competition.status !== "ARCHIVED" && (
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            title="Bearbeiten"
            aria-label="Bearbeiten"
            onClick={() => router.push(`/competitions/${competition.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        <CompetitionStatusActions competition={competition} disabled={isPending} />

        {/* Destruktiv */}
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          title="Löschen"
          aria-label="Löschen"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        {/* Zurück (nur auf Detailseiten) */}
        {backHref && (
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            title="Zurück"
            aria-label="Zurück"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </DetailActionBar>

      {/* Löschen bestätigen */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wettbewerb löschen?</AlertDialogTitle>
            <AlertDialogDescription>{`Wettbewerb „${competition.name}" wirklich löschen?`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
