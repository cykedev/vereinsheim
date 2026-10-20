import { useState } from "react"
import { UserCheck, UserX } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { participantActivate, participantDeactivate } from "@/lib/consequences"

interface Props {
  firstName: string
  lastName: string
  isActive: boolean
  isPending: boolean
  onConfirm: () => void
}

export function ToggleActiveAction({ firstName, lastName, isActive, isPending, onConfirm }: Props) {
  const [open, setOpen] = useState(false)
  const name = `${firstName} ${lastName}`
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title={isActive ? "Deaktivieren" : "Aktivieren"}
        aria-label={isActive ? "Deaktivieren" : "Aktivieren"}
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
      </Button>
      <DecisionDialog
        decision={isActive ? participantDeactivate({ name }) : participantActivate({ name })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
      />
    </>
  )
}
