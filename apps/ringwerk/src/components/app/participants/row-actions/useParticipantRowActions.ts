import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setParticipantActive, deleteParticipant } from "@/lib/participants/actions"

export function useParticipantRowActions(participantId: string, isActive: boolean) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setParticipantActive(participantId, !isActive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      }
    })
  }

  function handleDelete(force: boolean) {
    startTransition(async () => {
      const result = await deleteParticipant(participantId, force)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        setDeleteOpen(false)
      }
    })
  }

  return {
    editOpen,
    setEditOpen,
    deleteOpen,
    setDeleteOpen,
    confirmName,
    setConfirmName,
    isPending,
    handleToggleActive,
    handleDelete,
  }
}

export type ParticipantRowActionsState = ReturnType<typeof useParticipantRowActions>
