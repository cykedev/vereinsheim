import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  withdrawParticipant,
  revokeWithdrawal,
  unenrollParticipant,
  updateParticipantDiscipline,
} from "@/lib/competitionParticipants/actions"
import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"

export function useParticipantActions(entry: CompetitionParticipantListItem) {
  const [isPending, startTransition] = useTransition()
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [disciplineOpen, setDisciplineOpen] = useState(false)
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(entry.disciplineId ?? "")

  function handleWithdraw() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("reason", reason)
      const result = await withdrawParticipant(entry.id, null, fd)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Rückzug.")
      } else {
        setWithdrawOpen(false)
        setReason("")
      }
    })
  }

  function handleRevokeWithdrawal() {
    startTransition(async () => {
      const result = await revokeWithdrawal(entry.id)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Rückgängigmachen."
        )
      }
    })
  }

  function handleUnenroll() {
    startTransition(async () => {
      const result = await unenrollParticipant(entry.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Entfernen.")
      }
    })
  }

  function handleDisciplineSave() {
    if (!selectedDisciplineId) return
    startTransition(async () => {
      const result = await updateParticipantDiscipline(entry.id, selectedDisciplineId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Ändern der Disziplin."
        )
      } else {
        setDisciplineOpen(false)
      }
    })
  }

  return {
    isPending,
    withdrawOpen,
    setWithdrawOpen,
    reason,
    setReason,
    disciplineOpen,
    setDisciplineOpen,
    selectedDisciplineId,
    setSelectedDisciplineId,
    handleWithdraw,
    handleRevokeWithdrawal,
    handleUnenroll,
    handleDisciplineSave,
  }
}

export type ParticipantActionsState = ReturnType<typeof useParticipantActions>
