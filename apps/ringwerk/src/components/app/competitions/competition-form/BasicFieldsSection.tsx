import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vereinsheim/ui/select"
import { FieldError } from "@vereinsheim/ui/field-error"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { CompetitionFormState } from "./useCompetitionFormState"
import {
  BEST_OF_SINGLE_SCORING_MODE_LABELS,
  EVENT_SCORING_MODE_LABELS,
  SEASON_WERTUNG_LABELS,
  SERIES_SCORING_MODE_LABELS,
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
    seasonSortMode,
    seasonWertung,
    setSeasonWertung,
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

  // Beim Anlegen zählt die Typ-Auswahl, beim Bearbeiten der gespeicherte Typ (Typ ist dann fix).
  const isSeason = isEdit ? competition?.type === "SEASON" : type === "SEASON"

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

      {/* Wertungsmodus — bei SEASON führt dieselbe Auswahl auch die alternierenden Sortierungen */}
      <div className="space-y-2">
        <Label htmlFor="scoringMode">Wertungsmodus</Label>
        <Select
          value={isSeason ? seasonWertung : scoringMode}
          onValueChange={isSeason ? setSeasonWertung : setScoringMode}
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
                : isSeason
                  ? SEASON_WERTUNG_LABELS
                  : type === "LEAGUE"
                    ? SERIES_SCORING_MODE_LABELS
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
        <input type="hidden" name="seasonSortMode" value={isSeason ? seasonSortMode : ""} />
        {isBestOfSingle && (
          <p className="text-xs text-muted-foreground">
            Im Best-of-Modus nur Ringteiler, Ringe, Zehntelringe oder Teiler erlaubt.
          </p>
        )}
        {isSeason && seasonSortMode !== "" && (
          <p className="text-xs text-muted-foreground">
            Die Rangliste wechselt zeilenweise zwischen bestem Teiler und besten Ringen; Tabelle und
            PDF nutzen dieselbe Reihenfolge, manuelles Sortieren ist deaktiviert. Das Eingabeformat
            der Ringe folgt der Disziplin.
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
