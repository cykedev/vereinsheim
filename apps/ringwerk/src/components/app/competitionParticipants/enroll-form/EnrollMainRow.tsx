import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ParticipantOption } from "@/lib/participants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { EnrollFormState } from "./useEnrollForm"

interface Props {
  form: EnrollFormState
  availableParticipants: ParticipantOption[]
  noRegularParticipants: boolean
  isMixed: boolean
  isTeamEvent: boolean
  disciplines?: SerializableDiscipline[]
}

// Auswahlzeile: Teilnehmer/Gast + Disziplin + (bei Nicht-Team) Einschreiben-Button.
export function EnrollMainRow({
  form,
  availableParticipants,
  noRegularParticipants,
  isMixed,
  isTeamEvent,
  disciplines,
}: Props) {
  const { isPending, isGuest, handleSubmit } = form

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      {isGuest ? (
        <div className="flex-1 flex flex-col gap-2">
          <Label htmlFor="guestName" className="sm:sr-only">
            Name des Gastes
          </Label>
          <Input
            id="guestName"
            name="guestName"
            placeholder="Name des Gastes…"
            disabled={isPending}
            autoComplete="off"
          />
        </div>
      ) : (
        <>
          {noRegularParticipants ? (
            <p className="flex-1 text-sm text-muted-foreground self-center">
              Alle aktiven Teilnehmer sind bereits eingeschrieben.
            </p>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <Label htmlFor="participantId" className="sm:sr-only">
                Teilnehmer
              </Label>
              <Select name="participantId" disabled={isPending}>
                <SelectTrigger id="participantId" className="w-full">
                  <SelectValue placeholder="Teilnehmer wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {availableParticipants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      {isMixed && disciplines && (
        <div className="flex-1 flex flex-col gap-1">
          <Label htmlFor="disciplineId" className="sm:sr-only">
            Disziplin
          </Label>
          <Select name="disciplineId" disabled={isPending}>
            <SelectTrigger id="disciplineId" className="w-full">
              <SelectValue placeholder="Disziplin wählen…" />
            </SelectTrigger>
            <SelectContent>
              {disciplines.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(isGuest || !noRegularParticipants) && !isTeamEvent && (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full sm:w-auto sm:shrink-0"
        >
          {isPending ? "Lädt…" : "Einschreiben"}
        </Button>
      )}
    </div>
  )
}
