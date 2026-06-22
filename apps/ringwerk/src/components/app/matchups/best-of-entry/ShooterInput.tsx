import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { RingsInput } from "@/components/app/series/RingsInput"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import type { ScoringType } from "@/generated/prisma/client"

interface Props {
  label: string
  idPrefix: string
  rings: string
  teiler: string
  scoringType: ScoringType
  shotsPerSeries: number
  teilerFaktor: number
  disciplineId: string | null
  isPending: boolean
  onRingsChange: (v: string) => void
  onTeilerChange: (v: string) => void
}

// Eingabeblock pro Schütze (Gesamtringe + bester Teiler).
export function ShooterInput({
  label,
  idPrefix,
  rings,
  teiler,
  scoringType,
  shotsPerSeries,
  teilerFaktor,
  disciplineId,
  isPending,
  onRingsChange,
  onTeilerChange,
}: Props) {
  const teilerNum = parseFloat(teiler.replace(",", "."))
  const effectiveFactor = effectiveTeilerFaktor(disciplineId, teilerFaktor)
  const correctedTeiler =
    isNaN(teilerNum) || effectiveFactor === 1 ? null : teilerNum * effectiveFactor

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-rings`} className="text-xs text-muted-foreground">
            Gesamtringe
          </Label>
          <RingsInput
            id={`${idPrefix}-rings`}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            value={rings}
            onChange={(e) => onRingsChange(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-teiler`} className="text-xs text-muted-foreground">
            Bester Teiler
          </Label>
          <Input
            id={`${idPrefix}-teiler`}
            type="text"
            inputMode="decimal"
            value={teiler}
            onChange={(e) => onTeilerChange(e.target.value)}
            placeholder="z.B. 3,7"
            disabled={isPending}
          />
          {correctedTeiler !== null && (
            <p className="text-xs text-muted-foreground">
              Korr. Teiler: {correctedTeiler.toFixed(2).replace(".", ",")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
