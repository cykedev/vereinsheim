import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { addPlayoffDuel, deleteLastPlayoffDuel } from "@/lib/playoffs/actions"
import { requiredWinsFromBestOf } from "@/lib/playoffs/calculatePlayoffs"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"

interface Args {
  match: PlayoffMatchItem
  canManage: boolean
  playoffBestOf: number | null
}

export function usePlayoffMatchCard({ match, canManage, playoffBestOf }: Args) {
  const requiredWins = requiredWinsFromBestOf(playoffBestOf)
  const bestOfLabel = playoffBestOf ? `Best-of-${playoffBestOf}` : "Best-of-Five"
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [confirmDuelId, setConfirmDuelId] = useState<string | null>(null)

  const isFinal = match.round === "FINAL"
  const isCompleted = match.status === "COMPLETED"
  const winnerId =
    match.winsA > match.winsB
      ? match.participantA.id
      : match.winsB > match.winsA
        ? match.participantB.id
        : null

  // Nächstes offenes Duell (für "Eintragen"-Button)
  const nextPendingDuel = match.duels.find((d) => !d.isCompleted)

  // Letztes Duell (für Delete-Button)
  const lastDuelId = match.duels.length > 0 ? match.duels[match.duels.length - 1].id : null

  // Ob "Duell anlegen"-Button angezeigt werden soll:
  // - Nicht-Finale: wenn kein offenes Duell vorhanden (deckt auch 0 Duelle ab)
  // - Finale: nur wenn noch gar kein Duell angelegt wurde (Folge-Duelle via SD automatisch)
  const canAddDuel =
    canManage &&
    !isCompleted &&
    nextPendingDuel === undefined &&
    (!isFinal || match.duels.length === 0)

  // The action no longer revalidates the playoffs route — refresh client-side here.
  // router.refresh() runs outside a transition so the button never sticks at
  // "Anlegen…" and a single click reliably re-fetches (no interrupted transition).
  async function handleAddDuel() {
    setSubmitting(true)
    const result = await addPlayoffDuel(match.id)
    setSubmitting(false)
    if ("error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Fehler beim Anlegen des Duells."
      )
      return
    }
    router.refresh()
  }

  async function handleDeleteDuel() {
    if (!confirmDuelId) return
    setSubmitting(true)
    const result = await deleteLastPlayoffDuel(confirmDuelId)
    setSubmitting(false)
    setConfirmDuelId(null)
    if ("error" in result) {
      toast.error(
        typeof result.error === "string" ? result.error : "Fehler beim Löschen des Duells."
      )
      return
    }
    router.refresh()
  }

  const nameA = `${match.participantA.firstName} ${match.participantA.lastName}`
  const nameB = `${match.participantB.firstName} ${match.participantB.lastName}`

  return {
    requiredWins,
    bestOfLabel,
    submitting,
    confirmDuelId,
    setConfirmDuelId,
    isFinal,
    isCompleted,
    winnerId,
    nextPendingDuel,
    lastDuelId,
    canAddDuel,
    handleAddDuel,
    handleDeleteDuel,
    nameA,
    nameB,
  }
}

export type PlayoffMatchCardState = ReturnType<typeof usePlayoffMatchCard>
