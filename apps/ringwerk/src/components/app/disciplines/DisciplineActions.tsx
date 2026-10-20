"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { toast } from "sonner"
import { disciplineDelete } from "@/lib/consequences"
import { setDisciplineArchived, deleteDiscipline } from "@/lib/disciplines/actions"
import type { SerializableDiscipline } from "@/lib/disciplines/types"

interface Props {
  discipline: SerializableDiscipline
}

export function DisciplineActions({ discipline }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleArchive(archive: boolean) {
    startTransition(async () => {
      const result = await setDisciplineArchived(discipline.id, archive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Archivieren.")
      } else {
        toast.success(archive ? "Disziplin archiviert." : "Disziplin wiederhergestellt.")
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDiscipline(discipline.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        toast.success("Disziplin gelöscht.")
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

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-destructive hover:text-destructive"
        title="Löschen"
        aria-label="Löschen"
        disabled={isPending}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <DecisionDialog
        decision={disciplineDelete({ name: discipline.name, system: discipline.isSystem })}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </div>
  )
}
