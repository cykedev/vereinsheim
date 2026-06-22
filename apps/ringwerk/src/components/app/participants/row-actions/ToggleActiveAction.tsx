import { UserCheck, UserX } from "lucide-react"
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

interface Props {
  firstName: string
  lastName: string
  isActive: boolean
  isPending: boolean
  onConfirm: () => void
}

export function ToggleActiveAction({ firstName, lastName, isActive, isPending, onConfirm }: Props) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title={isActive ? "Deaktivieren" : "Aktivieren"}
          disabled={isPending}
        >
          {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? "Teilnehmer deaktivieren?" : "Teilnehmer aktivieren?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `${lastName}, ${firstName} wird deaktiviert und kann keinen Ligen mehr hinzugefügt werden.`
              : `${lastName}, ${firstName} wird wieder aktiviert.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isActive ? "Deaktivieren" : "Aktivieren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
