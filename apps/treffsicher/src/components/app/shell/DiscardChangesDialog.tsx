"use client"

import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { leaveUnsaved } from "@/lib/consequences"

interface Props {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

// Verwerfen-Dialog für den Schutz vor ungespeicherten Änderungen in Langformularen; der Wortlaut steht in
// `leaveUnsaved`.
export function DiscardChangesDialog({ open, onCancel, onConfirm }: Props) {
  return (
    <DecisionDialog
      decision={leaveUnsaved()}
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      onConfirm={onConfirm}
    />
  )
}
