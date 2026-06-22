import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldError } from "@/components/ui/field-error"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { CompetitionFormState } from "./useCompetitionFormState"
import {
  BEST_OF_SINGLE_SCORING_MODE_LABELS,
  EVENT_SCORING_MODE_LABELS,
  SEASON_SCORING_MODE_LABELS,
} from "./constants"

interface Props {
  form: CompetitionFormState
  competition?: CompetitionDetail
  disciplines: SerializableDiscipline[]
  hasMatchups: boolean
}

export function BasicFieldsSection({ form, competition, disciplines, hasMatchups }: Props) {
  const {
    isPending,
    isEdit,
    type,
    setType,
    scoringMode,
    setScoringMode,
    isBestOfSingle,
    name,
    setName,
    shotsPerSeries,
    setShotsPerSeries,
    disciplineId,
    setDisciplineId,
    nameError,
    disciplineIdError,
  } = form

  return (
    <>
      {/* Typ (nur bei Erstellung) */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="type">Typ</Label>
          <Select name="type" value={type} onValueChange={setType} disabled={isPending}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LEAGUE">Liga</SelectItem>
              <SelectItem value="EVENT">Event (Kranzlschiessen)</SelectItem>
              <SelectItem value="SEASON">Saison (Jahrespreisschiessen)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            type === "EVENT"
              ? "z.B. Kranzlschiessen 2026"
              : type === "SEASON"
                ? "z.B. Jahrespreisschiessen 2026"
                : "z.B. Winterliga 2026"
          }
          disabled={isPending}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "name-error" : undefined}
        />
        <FieldError id="name-error" message={nameError} />
      </div>

      {/* Wertungsmodus */}
      <div className="space-y-2">
        <Label htmlFor="scoringMode">Wertungsmodus</Label>
        <Select
          value={scoringMode}
          onValueChange={setScoringMode}
          disabled={
            isPending || (hasMatchups && (type === "LEAGUE" || competition?.type === "LEAGUE"))
          }
        >
          <SelectTrigger id="scoringMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(
              isBestOfSingle
                ? BEST_OF_SINGLE_SCORING_MODE_LABELS
                : type === "SEASON" || type === "LEAGUE"
                  ? SEASON_SCORING_MODE_LABELS
                  : EVENT_SCORING_MODE_LABELS
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Always submit scoringMode: a disabled (locked) Radix Select does not
            submit its value, but the schema requires it. The action still ignores
            it when the ruleset is locked. */}
        <input type="hidden" name="scoringMode" value={scoringMode} />
        {isBestOfSingle && (
          <p className="text-xs text-muted-foreground">
            Im Best-of-Modus nur Ringteiler, Ringe, Zehntelringe oder Teiler erlaubt.
          </p>
        )}
      </div>

      {/* Schusszahl (nur für Event/Saison — Liga hat es im Regelset) */}
      {type !== "LEAGUE" && !(isEdit && competition?.type === "LEAGUE") && (
        <div className="space-y-2">
          <Label htmlFor="shotsPerSeries">Schuss pro Serie</Label>
          <Input
            id="shotsPerSeries"
            name="shotsPerSeries"
            type="number"
            min={1}
            max={100}
            value={shotsPerSeries}
            onChange={(e) => setShotsPerSeries(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      {/* Disziplin */}
      <div className="space-y-2">
        <Label htmlFor="disciplineId">Disziplin</Label>
        <Select
          name="disciplineId"
          value={disciplineId}
          onValueChange={setDisciplineId}
          disabled={isPending || isEdit}
        >
          <SelectTrigger id="disciplineId">
            <SelectValue placeholder="Disziplin wählen…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mixed">Gemischt (Faktor-Korrektur)</SelectItem>
            {disciplines.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Die Disziplin kann nach der Erstellung nicht mehr geändert werden.
          </p>
        )}
        <FieldError id="disciplineId-error" message={disciplineIdError} />
      </div>
    </>
  )
}
