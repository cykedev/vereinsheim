import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { updateParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "../ParticipantForm"

interface Props {
  participantId: string
  firstName: string
  lastName: string
  contact: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ParticipantEditDialog({
  participantId,
  firstName,
  lastName,
  contact,
  open,
  onOpenChange,
}: Props) {
  const action = updateParticipant.bind(null, participantId)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Bearbeiten"
        onClick={() => onOpenChange(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teilnehmer bearbeiten</DialogTitle>
          </DialogHeader>
          <ParticipantForm
            participant={{ firstName, lastName, contact }}
            action={action}
            onSuccess={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
