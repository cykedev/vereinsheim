import { Button } from "@vereinsheim/ui/button"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import type { ScoringType } from "@/generated/prisma/client"
import { ShooterInput } from "./ShooterInput"
import type { BestOfEntryState } from "./useBestOfEntry"

interface Props {
  entry: BestOfEntryState
  scoringType: ScoringType
  shotsPerSeries: number
  teilerFaktor: number
  disciplineId: string | null
}

// Eingabe-Panels für das nächste Duell bzw. den Stechschuss.
export function DuelInputPanels({
  entry,
  scoringType,
  shotsPerSeries,
  teilerFaktor,
  disciplineId,
}: Props) {
  const {
    matchStatus,
    nextDuelNumber,
    homeName,
    awayName,
    homeRings,
    setHomeRings,
    homeTeiler,
    setHomeTeiler,
    awayRings,
    setAwayRings,
    awayTeiler,
    setAwayTeiler,
    homeShot,
    setHomeShot,
    awayShot,
    setAwayShot,
    isPending,
    error,
    handleSaveDuel,
    handleSaveStechschuss,
  } = entry

  return (
    <>
      {/* Next duel input */}
      {matchStatus.kind === "in_progress" && (
        <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            Duell {nextDuelNumber} eintragen
          </p>
          <ShooterInput
            label={homeName}
            idPrefix={`home-d${nextDuelNumber}`}
            rings={homeRings}
            teiler={homeTeiler}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            teilerFaktor={teilerFaktor}
            disciplineId={disciplineId}
            isPending={isPending}
            onRingsChange={setHomeRings}
            onTeilerChange={setHomeTeiler}
          />
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">vs.</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ShooterInput
            label={awayName}
            idPrefix={`away-d${nextDuelNumber}`}
            rings={awayRings}
            teiler={awayTeiler}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            teilerFaktor={teilerFaktor}
            disciplineId={disciplineId}
            isPending={isPending}
            onRingsChange={setAwayRings}
            onTeilerChange={setAwayTeiler}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" className="w-full" onClick={handleSaveDuel} disabled={isPending}>
            {isPending ? "Speichern…" : "Duell speichern"}
          </Button>
        </div>
      )}

      {/* Stechschuss input */}
      {matchStatus.kind === "needs_tiebreak" && (
        <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground">Stechschuss eintragen</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="dialog-home-shot" className="text-xs text-muted-foreground">
                  {homeName}
                </Label>
                <Input
                  id="dialog-home-shot"
                  type="text"
                  inputMode="decimal"
                  placeholder="z.B. 9,8"
                  value={homeShot}
                  onChange={(e) => setHomeShot(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dialog-away-shot" className="text-xs text-muted-foreground">
                  {awayName}
                </Label>
                <Input
                  id="dialog-away-shot"
                  type="text"
                  inputMode="decimal"
                  placeholder="z.B. 9,5"
                  value={awayShot}
                  onChange={(e) => setAwayShot(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Ein Schuss — höchster Wert gewinnt.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button size="sm" className="w-full" onClick={handleSaveStechschuss} disabled={isPending}>
            {isPending ? "Speichern…" : "Stechschuss speichern"}
          </Button>
        </div>
      )}
    </>
  )
}
