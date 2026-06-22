import { Lock } from "lucide-react"
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
import { SEASON_SCORING_MODE_LABELS } from "./constants"

interface Props {
  form: CompetitionFormState
  playoffsStarted: boolean
}

// Playoffs & Finale — editierbar, bis die Playoffs gestartet sind
export function LeaguePlayoffsFieldset({ form, playoffsStarted }: Props) {
  const {
    isPending,
    playoffBestOf,
    setPlayoffBestOf,
    playoffHasViertelfinale,
    setPlayoffHasViertelfinale,
    playoffHasAchtelfinale,
    setPlayoffHasAchtelfinale,
    finalePrimary,
    setFinalePrimary,
    finaleTiebreaker1,
    setFinaleTiebreaker1,
    finaleTiebreaker2,
    setFinaleTiebreaker2,
    finaleHasSuddenDeath,
    setFinaleHasSuddenDeath,
  } = form

  return (
    <fieldset disabled={playoffsStarted || isPending} className="space-y-4 border-t pt-4">
      {playoffsStarted && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Playoffs gesperrt — bereits gestartet
        </span>
      )}
      <div className="space-y-2">
        <Label htmlFor="playoffBestOf">Finale/Halbfinale – Best-of</Label>
        <Select name="playoffBestOf" value={playoffBestOf} onValueChange={setPlayoffBestOf}>
          <SelectTrigger id="playoffBestOf">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Best-of-3 (2 Siege)</SelectItem>
            <SelectItem value="5">Best-of-5 (3 Siege)</SelectItem>
            <SelectItem value="7">Best-of-7 (4 Siege)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input
            id="playoffHasViertelfinale"
            name="playoffHasViertelfinale"
            type="checkbox"
            value="true"
            checked={playoffHasViertelfinale}
            onChange={(e) => setPlayoffHasViertelfinale(e.target.checked)}
          />
          <Label htmlFor="playoffHasViertelfinale">Viertelfinale (8 TN)</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="playoffHasAchtelfinale"
            name="playoffHasAchtelfinale"
            type="checkbox"
            value="true"
            checked={playoffHasAchtelfinale}
            onChange={(e) => setPlayoffHasAchtelfinale(e.target.checked)}
          />
          <Label htmlFor="playoffHasAchtelfinale">Achtelfinale (16 TN)</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="finalePrimary">Finale – Hauptkriterium</Label>
        <Select name="finalePrimary" value={finalePrimary} onValueChange={setFinalePrimary}>
          <SelectTrigger id="finalePrimary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SEASON_SCORING_MODE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Primäres Wertungskriterium im Finale (immer aktiv).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="finaleTiebreaker1">Finale – Tiebreaker 1</Label>
        <Select
          name="finaleTiebreaker1"
          value={finaleTiebreaker1}
          onValueChange={(v) => {
            setFinaleTiebreaker1(v)
            if (v === "none") setFinaleTiebreaker2("none")
          }}
        >
          <SelectTrigger id="finaleTiebreaker1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Kein Tiebreaker</SelectItem>
            {Object.entries(SEASON_SCORING_MODE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Bei Gleichstand nach Hauptkriterium (optional).
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="finaleTiebreaker2">Finale – Tiebreaker 2</Label>
        <Select
          name="finaleTiebreaker2"
          value={finaleTiebreaker2}
          onValueChange={setFinaleTiebreaker2}
          disabled={finaleTiebreaker1 === "none"}
        >
          <SelectTrigger id="finaleTiebreaker2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Kein Tiebreaker</SelectItem>
            {Object.entries(SEASON_SCORING_MODE_LABELS).map(([value, label]) => (
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
          id="finaleHasSuddenDeath"
          name="finaleHasSuddenDeath"
          checked={finaleHasSuddenDeath}
          onCheckedChange={(checked: boolean | "indeterminate") =>
            setFinaleHasSuddenDeath(checked === true)
          }
        />
        <Label htmlFor="finaleHasSuddenDeath" className="cursor-pointer">
          Finale: Gleichstand per Stechschuss
        </Label>
      </div>
      <input
        type="hidden"
        name="finaleHasSuddenDeath"
        value={finaleHasSuddenDeath ? "true" : "false"}
      />
    </fieldset>
  )
}
