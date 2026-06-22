import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RingsInput } from "@/components/app/series/RingsInput"
import type { ScoringType } from "@/generated/prisma/client"
import type { SeasonSeriesFormState } from "./useSeasonSeriesForm"

interface Discipline {
  id: string
  name: string
  scoringType: ScoringType
  teilerFaktor: number
}

interface Props {
  form: SeasonSeriesFormState
  shotsPerSeries: number
  disciplines?: Discipline[]
}

// Formularfelder der Saison-Serie (Datum, Disziplin, Ringe, Teiler).
export function SeasonSeriesFormFields({ form, shotsPerSeries, disciplines }: Props) {
  const {
    isMixed,
    isPending,
    sessionDate,
    setSessionDate,
    selectedDisciplineId,
    setSelectedDisciplineId,
    rings,
    setRings,
    teiler,
    setTeiler,
    effectiveScoringType,
    correctedTeiler,
    fieldErrors,
    generalError,
    formAction,
  } = form

  return (
    <form id="season-series-form" action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sessionDate">Datum</Label>
        <Input
          id="sessionDate"
          name="sessionDate"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          disabled={isPending}
          autoFocus
        />
        {fieldErrors?.sessionDate && (
          <p className="text-sm text-destructive">{fieldErrors.sessionDate[0]}</p>
        )}
      </div>

      {isMixed && disciplines && (
        <div className="space-y-2">
          <Label htmlFor="disciplineId">Disziplin</Label>
          <Select
            name="disciplineId"
            value={selectedDisciplineId ?? undefined}
            onValueChange={setSelectedDisciplineId}
            disabled={isPending}
          >
            <SelectTrigger id="disciplineId">
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

      <div className="space-y-2">
        <Label htmlFor="rings">Gesamtringe</Label>
        <RingsInput
          id="rings"
          name="rings"
          scoringType={effectiveScoringType}
          shotsPerSeries={shotsPerSeries}
          value={rings}
          onChange={(e) => setRings(e.target.value)}
          disabled={isPending}
        />
        {fieldErrors?.rings && <p className="text-sm text-destructive">{fieldErrors.rings[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="teiler">Bester Teiler</Label>
        <Input
          id="teiler"
          name="teiler"
          type="text"
          inputMode="decimal"
          placeholder="z.B. 3,7"
          value={teiler}
          onChange={(e) => setTeiler(e.target.value)}
          disabled={isPending}
        />
        {fieldErrors?.teiler && <p className="text-sm text-destructive">{fieldErrors.teiler[0]}</p>}
        {correctedTeiler !== null && (
          <p className="text-xs text-muted-foreground">
            Korr. Teiler: {correctedTeiler.toFixed(2)}
          </p>
        )}
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}
    </form>
  )
}
