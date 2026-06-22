import { UserCheck, Trash2 } from "lucide-react"
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

interface RevokeProps {
  fullName: string
  isPending: boolean
  onConfirm: () => void
}

// Rückzug rückgängig machen (für zurückgezogene Teilnehmer).
export function RevokeWithdrawalAction({ fullName, isPending, onConfirm }: RevokeProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="Rückzug rückgängig"
          disabled={isPending}
        >
          <UserCheck className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rückzug rückgängig machen?</AlertDialogTitle>
          <AlertDialogDescription>
            {fullName} wird wieder als aktiv eingeschrieben.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Rückgängig machen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface UnenrollProps {
  fullName: string
  isPending: boolean
  onConfirm: () => void
}

// Teilnehmer dauerhaft aus dem Wettbewerb entfernen.
export function UnenrollAction({ fullName, isPending, onConfirm }: UnenrollProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive/70 hover:text-destructive"
          title="Aus Wettbewerb entfernen"
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aus Wettbewerb entfernen?</AlertDialogTitle>
          <AlertDialogDescription>
            {fullName} wird dauerhaft aus diesem Wettbewerb entfernt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Entfernen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
