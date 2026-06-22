"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { setDisciplineArchived, deleteDiscipline } from "@/lib/disciplines/actions"
import type { SerializableDiscipline } from "@/lib/disciplines/types"

interface Props {
  discipline: SerializableDiscipline
}

export function DisciplineActions({ discipline }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleArchive(archive: boolean) {
    startTransition(async () => {
      const result = await setDisciplineArchived(discipline.id, archive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Archivieren.")
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDiscipline(discipline.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {!discipline.isArchived && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="Bearbeiten"
          onClick={() => router.push(`/disciplines/${discipline.id}/edit`)}
          disabled={isPending}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {!discipline.isArchived ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="Archivieren"
          onClick={() => handleArchive(true)}
          disabled={isPending}
        >
          <Archive className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="Wiederherstellen"
          onClick={() => handleArchive(false)}
          disabled={isPending}
        >
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive hover:text-destructive"
            title="Löschen"
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disziplin löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Disziplin „${discipline.name}" wirklich löschen?`}
            </AlertDialogDescription>
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
    </div>
  )
}
