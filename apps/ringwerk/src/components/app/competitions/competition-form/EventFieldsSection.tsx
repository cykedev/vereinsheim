import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vereinsheim/ui/select"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { CompetitionFormState } from "./useCompetitionFormState"
import { TARGET_VALUE_TYPE_LABELS } from "./constants"

interface Props {
  form: CompetitionFormState
  competition?: CompetitionDetail
}

export function EventFieldsSection({ form, competition }: Props) {
  const {
    isPending,
    isEdit,
    type,
    eventDate,
    setEventDate,
    allowGuests,
    setAllowGuests,
    teamSize,
    setTeamSize,
    teamScoring,
    setTeamScoring,
    isTargetMode,
    targetValue,
    setTargetValue,
    targetValueType,
    setTargetValueType,
  } = form

  if (!(type === "EVENT" || (isEdit && competition?.type === "EVENT"))) return null

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="eventDate">Veranstaltungsdatum (optional)</Label>
        <Input
          id="eventDate"
          name="eventDate"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="allowGuests"
          name="allowGuests"
          checked={allowGuests}
          onCheckedChange={(checked: boolean | "indeterminate") => setAllowGuests(checked === true)}
          disabled={isPending}
        />
        <Label htmlFor="allowGuests" className="cursor-pointer">
          Gastteilnehmer erlaubt
        </Label>
      </div>
      {/* Hidden field damit der Wert immer im FormData landet */}
      <input type="hidden" name="allowGuests" value={allowGuests ? "true" : "false"} />

      {/* Team-Modus */}
      <div className="space-y-2">
        <Label htmlFor="teamSize">Teamgröße (optional)</Label>
        <Input
          id="teamSize"
          name="teamSize"
          type="number"
          min={2}
          max={20}
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          placeholder="z.B. 2 für Zweier-Teams"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Leer lassen für Einzelwertung. Ab 2 wird ein Team-Modus aktiviert.
        </p>
      </div>

      {Number(teamSize) >= 2 && (
        <div className="space-y-2">
          <Label htmlFor="teamScoring">Team-Wertung</Label>
          <Select
            name="teamScoring"
            value={teamScoring}
            onValueChange={setTeamScoring}
            disabled={isPending}
          >
            <SelectTrigger id="teamScoring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUM">Summe (alle Einzel-Ergebnisse addiert)</SelectItem>
              <SelectItem value="BEST">Bestes (bestes Einzelergebnis im Team)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isTargetMode && (
        <>
          <div className="space-y-2">
            <Label htmlFor="targetValue">Zielwert</Label>
            <Input
              id="targetValue"
              name="targetValue"
              type="number"
              step="0.1"
              min={0}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="z.B. 512"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetValueType">Zielwert-Typ</Label>
            <Select
              name="targetValueType"
              value={targetValueType}
              onValueChange={setTargetValueType}
              disabled={isPending}
            >
              <SelectTrigger id="targetValueType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TARGET_VALUE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </>
  )
}
