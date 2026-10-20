import { Pencil, Plus } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { bestOfDuelDelete } from "@/lib/consequences"

interface DeleteConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** was der Dialog über das zuletzt eingetragene Duell sagt (`bestOfDuelDelete`) */
  duel: Parameters<typeof bestOfDuelDelete>[0]
}

// Bestätigung zum Zurücknehmen des letzten Duells oder Stechschusses.
export function DeleteDuelConfirm({ open, onOpenChange, onConfirm, duel }: DeleteConfirmProps) {
  return (
    <DecisionDialog
      decision={bestOfDuelDelete(duel)}
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
}

interface TriggerProps {
  hasResults: boolean
  onClick: () => void
}

// Trigger-Button: Stift bei vorhandenen Ergebnissen, sonst Plus.
export function EntryTriggerButton({ hasResults, onClick }: TriggerProps) {
  if (hasResults) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Duelle bearbeiten"
        onClick={onClick}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    )
  }
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-10 w-10"
      title="Duelle eintragen"
      onClick={onClick}
    >
      <Plus className="h-4 w-4" />
    </Button>
  )
}
