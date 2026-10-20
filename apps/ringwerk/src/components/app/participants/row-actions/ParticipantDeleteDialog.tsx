import { Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog, NoticeDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import {
  CONFIRM_LAST_NAME,
  participantDelete,
  participantDeleteBlocked,
  participantForceDelete,
} from "@/lib/consequences"
import type { ParticipantRowActionsState } from "./useParticipantRowActions"

interface Props {
  actions: ParticipantRowActionsState
  firstName: string
  lastName: string
  isAdmin: boolean
  competitionsCount: number
}

// Löschen eines inaktiven Teilnehmers: ohne Wettbewerb einfach, mit Wettbewerben nur ein Admin und nur mit dem
// Nachnamen als Bestätigung (die Action löscht dann alle Daten, auch die Serien der Gegner).
export function ParticipantDeleteDialog({
  actions,
  firstName,
  lastName,
  isAdmin,
  competitionsCount,
}: Props) {
  const { deleteOpen, setDeleteOpen, confirmName, setConfirmName, isPending, handleDelete } =
    actions
  const hasData = competitionsCount > 0
  const nameMatches = confirmName.trim() === lastName
  const name = `${firstName} ${lastName}`

  function onOpenChange(open: boolean) {
    setDeleteOpen(open)
    if (!open) setConfirmName("")
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Löschen"
        aria-label="Löschen"
        disabled={isPending}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {!hasData && (
        <DecisionDialog
          decision={participantDelete({ name })}
          open={deleteOpen}
          onOpenChange={onOpenChange}
          onConfirm={() => handleDelete(false)}
          confirmDisabled={isPending}
        />
      )}

      {hasData && !isAdmin && (
        <NoticeDialog
          {...participantDeleteBlocked({ name, competitions: competitionsCount })}
          open={deleteOpen}
          onOpenChange={onOpenChange}
        />
      )}

      {hasData && isAdmin && (
        <DecisionDialog
          decision={participantForceDelete({ name, competitions: competitionsCount })}
          open={deleteOpen}
          onOpenChange={onOpenChange}
          onConfirm={() => handleDelete(true)}
          confirmDisabled={!nameMatches || isPending}
        >
          <div className="space-y-2">
            <Label htmlFor="confirm-participant-name" className="block leading-normal">
              {CONFIRM_LAST_NAME} <span className="font-semibold">{lastName}</span>
            </Label>
            <Input
              id="confirm-participant-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={lastName}
              disabled={isPending}
              autoComplete="off"
            />
          </div>
        </DecisionDialog>
      )}
    </>
  )
}
