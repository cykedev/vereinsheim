import { Card, CardContent } from "@vereinsheim/ui/design2/card"
import { Label } from "@vereinsheim/ui/label"
import { Input } from "@vereinsheim/ui/input"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vereinsheim/ui/select"
import type {
  StatisticsFiltersCardActions,
  StatisticsFiltersCardModel,
  StatisticsFiltersPreset,
} from "@/components/app/statistics-charts/filterTypes"
import type { TypeFilter } from "@/components/app/statistics-charts/hooks/useStatisticsFilterState"
import type { DisplayMode } from "@/components/app/statistics-charts/types"

interface Props {
  model: StatisticsFiltersCardModel
  actions: StatisticsFiltersCardActions
}

const TYPE_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "TRAINING", label: "Training" },
  { value: "WETTKAMPF", label: "Wettkampf" },
] as const satisfies readonly { value: TypeFilter; label: string }[]

const PRESET_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "6m", label: "6 Monate" },
  { value: "3m", label: "3 Monate" },
  { value: "1m", label: "1 Monat" },
] as const satisfies readonly { value: StatisticsFiltersPreset; label: string }[]

const PRESET_ACTIONS: Partial<
  Record<StatisticsFiltersPreset, (actions: StatisticsFiltersCardActions) => void>
> = {
  all: (actions) => actions.selectAllTime(),
  "6m": (actions) => actions.select6Months(),
  "3m": (actions) => actions.select3Months(),
  "1m": (actions) => actions.select1Month(),
}

// Filterkarte hält alle Eingriffspunkte an einer Stelle, damit URL-/State-Sync konsistent bleibt.
export function StatisticsFiltersCard({ model, actions }: Props) {
  const {
    typeFilter,
    disciplineFilter,
    availableDisciplines,
    from,
    to,
    activeTimePreset,
    selectedDiscipline,
    effectiveDisplayMode,
    totalDisciplineShots,
    filteredCount,
    withScoreCount,
  } = model

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[auto_repeat(3,minmax(0,1fr))] [&>*]:min-w-0">
          <div className="space-y-2">
            <Label>Einheitentyp</Label>
            <Segmented<TypeFilter>
              label="Einheitentyp"
              options={TYPE_OPTIONS}
              value={typeFilter}
              onChange={actions.typeFilterChange}
              scroll
              className="w-full [&>button]:flex-1"
            />
          </div>

          <div className="space-y-2">
            <Label>Disziplin</Label>
            <Select value={disciplineFilter} onValueChange={actions.disciplineFilterChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Disziplinen</SelectItem>
                {availableDisciplines.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from">Von</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => actions.fromChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">Bis</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => actions.toChange(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Zeitraum</Label>
            {/* ein eigener Zeitraum (Von/Bis) wählt keine der Vorgaben */}
            <Segmented<StatisticsFiltersPreset>
              label="Zeitraum"
              options={PRESET_OPTIONS}
              value={activeTimePreset}
              onChange={(preset) => PRESET_ACTIONS[preset]?.(actions)}
              wrap
            />
          </div>

          {selectedDiscipline && (
            <div className="space-y-2">
              <Label>Anzeige</Label>
              {/* Anzeige-Modus nur mit Disziplin anbieten, weil die Hochrechnung ohne Schusszahl irreführend wäre. */}
              <Segmented<DisplayMode>
                label="Anzeige"
                options={[
                  { value: "per_shot", label: "Ringe/Sch." },
                  { value: "projected", label: `Hochrechnung (${totalDisciplineShots} Sch.)` },
                ]}
                value={effectiveDisplayMode}
                onChange={actions.displayModeChange}
                wrap
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {filteredCount} Einheit{filteredCount !== 1 ? "en" : ""} gefunden
            {withScoreCount !== filteredCount && ` · ${withScoreCount} mit Ergebnis`}
            {selectedDiscipline && ` · ${selectedDiscipline.name}`}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
