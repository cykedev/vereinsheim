import { useState } from "react"
import { UserCheck, Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog, NoticeDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { unenroll, unenrollBlocked, withdrawalRevoke } from "@/lib/consequences"

interface RevokeProps {
  name: string
  /** Tag des Rückzugs im Anzeigeformat, `null`, wenn unbekannt */
  since: string | null
  isPending: boolean
  onConfirm: () => void
}

// Rückzug zurücknehmen (für zurückgezogene Teilnehmer).
export function RevokeWithdrawalAction({ name, since, isPending, onConfirm }: RevokeProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Rückzug zurücknehmen"
        aria-label="Rückzug zurücknehmen"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        <UserCheck className="h-4 w-4" />
      </Button>
      <DecisionDialog
        decision={withdrawalRevoke({ name, since })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
      />
    </>
  )
}

interface UnenrollProps {
  /** bei Gästen nur der Vorname */
  name: string
  guest: boolean
  results: number
  team: number | null
  /** schon zurückgezogen: der Hinweis sagt das statt „nur zurückziehen“ */
  withdrawn: boolean
  isPending: boolean
  onConfirm: () => void
}

// Teilnehmer aus dem Wettbewerb entfernen (nur ohne Paarungen; sonst zurückziehen). Ein Mitglied mit Ergebnissen lässt
// sich nur zurückziehen; dann zeigt der Knopf den Hinweis statt der Rückfrage.
export function UnenrollAction({
  name,
  guest,
  results,
  team,
  withdrawn,
  isPending,
  onConfirm,
}: UnenrollProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-destructive hover:text-destructive"
        title="Aus Wettbewerb entfernen"
        aria-label="Aus Wettbewerb entfernen"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {!guest && results > 0 ? (
        <NoticeDialog
          {...unenrollBlocked({ name, results, withdrawn })}
          open={open}
          onOpenChange={setOpen}
        />
      ) : (
        <DecisionDialog
          decision={unenroll({ name, guest, results, team })}
          open={open}
          onOpenChange={setOpen}
          onConfirm={onConfirm}
        />
      )}
    </>
  )
}
