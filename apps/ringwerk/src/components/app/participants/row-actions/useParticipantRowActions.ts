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
      } else {
        toast.success(isActive ? "Teilnehmer deaktiviert." : "Teilnehmer aktiviert.")
      }
    })
  }

  function handleDelete(force: boolean) {
    startTransition(async () => {
      const result = force
        ? await deleteParticipant(participantId, true, confirmName)
        : await deleteParticipant(participantId, false)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        toast.success("Teilnehmer gelöscht.")
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
