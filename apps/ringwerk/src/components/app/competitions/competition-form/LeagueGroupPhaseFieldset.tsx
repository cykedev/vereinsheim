import { Lock } from "lucide-react"
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
import type { CompetitionFormState } from "./useCompetitionFormState"
import { BEST_OF_SINGLE_SCORING_MODE_LABELS } from "./constants"

interface Props {
  form: CompetitionFormState
  hasMatchups: boolean
}

// Gruppenphase & Format — gesperrt, sobald Paarungen existieren
export function LeagueGroupPhaseFieldset({ form, hasMatchups }: Props) {
  const {
    isPending,
    isBestOfSingle,
    leagueFormat,
    onLeagueFormatChange,
    groupBestOf,
    setGroupBestOf,
    groupPlayAllDuels,
    setGroupPlayAllDuels,
    groupTiebreaker1,
    setGroupTiebreaker1,
    groupTiebreaker2,
    setGroupTiebreaker2,
    groupHasSuddenDeath,
    setGroupHasSuddenDeath,
    shotsPerSeries,
    setShotsPerSeries,
  } = form

  return (
    <fieldset disabled={hasMatchups || isPending} className="space-y-4">
      {hasMatchups && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Gruppenphase &amp; Format gesperrt — Paarungen existieren bereits
        </span>
      )}
      {/* Liga-Format */}
      <div className="space-y-2">
        <Label htmlFor="leagueFormat">Format</Label>
        <Select name="leagueFormat" value={leagueFormat} onValueChange={onLeagueFormatChange}>
          <SelectTrigger id="leagueFormat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DOUBLE_ROUND_ROBIN">Doppelrunde (Hin/Rück)</SelectItem>
            <SelectItem value="BEST_OF_SINGLE">Best-of-Begegnung (einfache Runde)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* BEST_OF_SINGLE group-phase fields */}
      {isBestOfSingle && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">Gruppenphase (Best-of)</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupBestOf">Best-of</Label>
              <Select name="groupBestOf" value={groupBestOf} onValueChange={setGroupBestOf}>
                <SelectTrigger id="groupBestOf">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Best-of-3 (2 Siege)</SelectItem>
                  <SelectItem value="5">Best-of-5 (3 Siege)</SelectItem>
                  <SelectItem value="7">Best-of-7 (4 Siege)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="groupPlayAllDuels"
                  checked={groupPlayAllDuels}
                  onCheckedChange={(checked: boolean | "indeterminate") =>
                    setGroupPlayAllDuels(checked === true)
                  }
                />
                <Label htmlFor="groupPlayAllDuels" className="cursor-pointer">
                  Alle Duelle ausspielen
                </Label>
              </div>
            </div>
          </div>
          <input
            type="hidden"
            name="groupPlayAllDuels"
            value={groupPlayAllDuels ? "true" : "false"}
          />

          {/* Advanced / Tiebreaker area */}
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Erweitert (Tiebreaker &amp; Stechschuss)
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="groupTiebreaker1">Tiebreaker 1</Label>
                <Select
                  name="groupTiebreaker1"
                  value={groupTiebreaker1}
                  onValueChange={(v) => {
                    setGroupTiebreaker1(v)
                    if (v === "none") setGroupTiebreaker2("none")
                  }}
                >
                  <SelectTrigger id="groupTiebreaker1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Kein Tiebreaker</SelectItem>
                    {Object.entries(BEST_OF_SINGLE_SCORING_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bei Gleichstand nach Gruppenphase (optional).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupTiebreaker2">Tiebreaker 2</Label>
                <Select
                  name="groupTiebreaker2"
                  value={groupTiebreaker2}
                  onValueChange={setGroupTiebreaker2}
                  disabled={groupTiebreaker1 === "none"}
                >
                  <SelectTrigger id="groupTiebreaker2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Kein Tiebreaker</SelectItem>
                    {Object.entries(BEST_OF_SINGLE_SCORING_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bei Gleichstand nach Tiebreaker 1 (nur wenn TB1 gesetzt).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="groupHasSuddenDeath"
                  checked={groupHasSuddenDeath}
                  onCheckedChange={(checked: boolean | "indeterminate") =>
                    setGroupHasSuddenDeath(checked === true)
                  }
                />
                <Label htmlFor="groupHasSuddenDeath" className="cursor-pointer">
                  Gleichstand per Stechschuss
                </Label>
              </div>
              <input
                type="hidden"
                name="groupHasSuddenDeath"
                value={groupHasSuddenDeath ? "true" : "false"}
              />
            </div>
          </details>
        </div>
      )}
      {/* Schuss/Serie (Gruppenphase): nur klassische Liga (BEST_OF_SINGLE immer 10) */}
      {!isBestOfSingle && (
        <div className="space-y-2">
          <Label htmlFor="shotsPerSeriesLeague">Schuss/Serie</Label>
          <Input
            id="shotsPerSeriesLeague"
            name="shotsPerSeries"
            type="number"
            min={1}
            max={100}
            value={shotsPerSeries}
            onChange={(e) => setShotsPerSeries(e.target.value)}
          />
        </div>
      )}
      {isBestOfSingle && <input type="hidden" name="shotsPerSeries" value="10" />}
    </fieldset>
  )
}
