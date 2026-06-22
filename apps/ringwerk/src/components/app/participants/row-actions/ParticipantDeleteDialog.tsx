import { Trash2 } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vereinsheim/ui/alert-dialog"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import type { ParticipantRowActionsState } from "./useParticipantRowActions"

interface Props {
  actions: ParticipantRowActionsState
  firstName: string
  lastName: string
  isAdmin: boolean
  competitionsCount: number
}

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

  return (
    <AlertDialog
      open={deleteOpen}
      onOpenChange={(open) => {
        setDeleteOpen(open)
        if (!open) setConfirmName("")
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="Löschen"
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>

      {/* Variante 1: Keine Wettbewerbsdaten — einfache Bestätigung */}
      {!hasData && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teilnehmer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {lastName}, {firstName} wird endgültig gelöscht. Diese Aktion kann nicht rückgängig
              gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
            <Button variant="destructive" onClick={() => handleDelete(false)} disabled={isPending}>
              {isPending ? "Löschen…" : "Löschen"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}

      {/* Variante 2: Wettbewerbsdaten vorhanden, kein Admin */}
      {hasData && !isAdmin && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschen nicht möglich</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Teilnehmer hat {competitionsCount}{" "}
              {competitionsCount === 1 ? "Wettbewerb" : "Wettbewerbe"} und kann daher nicht gelöscht
              werden. Force-Delete ist nur für Admins möglich.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Schließen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}

      {/* Variante 3: Wettbewerbsdaten vorhanden, Admin — Force-Delete */}
      {hasData && isAdmin && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teilnehmer endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Teilnehmers
              werden dauerhaft gelöscht — inklusive {competitionsCount}{" "}
              {competitionsCount === 1 ? "Wettbewerb" : "Wettbewerbe"}, alle Serien und
              Liga-Paarungen (inkl. der Serien des jeweiligen Gegners).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-participant-name">
              Zur Bestätigung den Nachnamen eingeben:{" "}
              <span className="font-semibold">{lastName}</span>
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => handleDelete(true)}
              disabled={!nameMatches || isPending}
            >
              {isPending ? "Löschen…" : "Endgültig löschen"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
