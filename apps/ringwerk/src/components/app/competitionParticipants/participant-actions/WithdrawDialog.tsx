import { UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ParticipantActionsState } from "./useParticipantActions"

interface Props {
  actions: ParticipantActionsState
  fullName: string
}

export function WithdrawDialog({ actions, fullName }: Props) {
  const { isPending, withdrawOpen, setWithdrawOpen, reason, setReason, handleWithdraw } = actions

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Zurückziehen"
        onClick={() => setWithdrawOpen(true)}
        disabled={isPending}
      >
        <UserMinus className="h-4 w-4" />
      </Button>
      <Dialog
        open={withdrawOpen}
        onOpenChange={(open) => {
          setWithdrawOpen(open)
          if (!open) setReason("")
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Teilnehmer zurückziehen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {fullName} wird zurückgezogen. Alle Ergebnisse werden aus der Wertung genommen.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-reason">
              Begründung <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="withdraw-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. verletzt"
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleWithdraw} disabled={isPending}>
              {isPending ? "Zurückziehen…" : "Zurückziehen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
