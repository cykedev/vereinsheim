import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { playoffDuelDelete } from "@/lib/consequences"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** was der Dialog über das Duell sagt (`playoffDuelDelete`) */
  duel: Parameters<typeof playoffDuelDelete>[0]
}

export function DeleteDuelConfirm({ open, onOpenChange, onConfirm, duel }: Props) {
  return (
    <DecisionDialog
      decision={playoffDuelDelete(duel)}
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
}
