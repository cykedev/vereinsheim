import { Pencil, Plus } from "lucide-react"
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

interface DeleteConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

// Bestätigungsdialog zum Zurücknehmen des letzten Duells/Stechschusses.
export function DeleteDuelConfirm({ open, onOpenChange, onConfirm }: DeleteConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Letztes Ergebnis zurücknehmen?</AlertDialogTitle>
          <AlertDialogDescription>
            Das zuletzt eingetragene Duell (oder der letzte Stechschuss) wird gelöscht. Diese Aktion
            kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Zurücknehmen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
