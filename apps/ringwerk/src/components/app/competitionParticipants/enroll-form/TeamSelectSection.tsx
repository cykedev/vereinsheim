import { Button } from "@vereinsheim/ui/button"
import { Label } from "@vereinsheim/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vereinsheim/ui/select"
import type { EventTeamItem } from "@/lib/eventTeams/types"
import type { EnrollFormState } from "./useEnrollForm"

interface Props {
  form: EnrollFormState
  teamSize: number | null | undefined
  incompleteTeams: EventTeamItem[]
}

// Team-Auswahl (neues Team oder bestehendes unvollständiges Team) für Team-Events.
export function TeamSelectSection({ form, teamSize, incompleteTeams }: Props) {
  const { isPending, newTeam, setNewTeam, handleSubmit } = form

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="newTeam"
          checked={newTeam}
          onCheckedChange={(checked: boolean | "indeterminate") => setNewTeam(checked === true)}
          disabled={isPending}
        />
        <Label htmlFor="newTeam" className="cursor-pointer text-sm">
          Neues Team erstellen
        </Label>
        <input type="hidden" name="newTeam" value={newTeam ? "true" : "false"} />
      </div>

      {!newTeam && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="teamId" className="text-sm">
            Team wählen
          </Label>
          <Select name="teamId" disabled={isPending}>
            <SelectTrigger id="teamId" className="w-full">
              <SelectValue placeholder="Team wählen…" />
            </SelectTrigger>
            <SelectContent>
              {incompleteTeams.length === 0 ? (
                <SelectItem value="_none" disabled>
                  Keine unvollständigen Teams vorhanden
                </SelectItem>
              ) : (
                incompleteTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Team {t.teamNumber} ({t.members.length}/{teamSize})
                    {t.members.length > 0 && ` — ${t.members.map((m) => m.firstName).join(", ")}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || (!newTeam && incompleteTeams.length === 0)}
        className="w-full sm:w-auto"
      >
        {isPending ? "Lädt…" : "Einschreiben"}
      </Button>
    </div>
  )
}
