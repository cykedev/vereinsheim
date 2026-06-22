import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { RingsInput } from "@/components/app/series/RingsInput"
import type { ScoringType } from "@/generated/prisma/client"

interface Fields {
  totalRings: string
  teiler: string
}

interface Props {
  idPrefix: string
  name: string
  fields: Fields
  setFields: React.Dispatch<React.SetStateAction<Fields>>
  showTeiler: boolean
  scoringType: ScoringType
  shotsPerSeries: number
  submitting: boolean
}

// Eingabeblock (Gesamtringe + optional Teiler) für einen Playoff-Teilnehmer.
export function ParticipantResultFields({
  idPrefix,
  name,
  fields,
  setFields,
  showTeiler,
  scoringType,
  shotsPerSeries,
  submitting,
}: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{name}</p>
      <div className={showTeiler ? "grid grid-cols-2 gap-3" : "max-w-[160px]"}>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-rings`} className="text-xs text-muted-foreground">
            Gesamtringe
          </Label>
          <RingsInput
            id={`${idPrefix}-rings`}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            value={fields.totalRings}
            onChange={(e) => setFields((p) => ({ ...p, totalRings: e.target.value }))}
            disabled={submitting}
          />
        </div>
        {showTeiler && (
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-teiler`} className="text-xs text-muted-foreground">
              Bester Teiler
            </Label>
            <Input
              id={`${idPrefix}-teiler`}
              type="text"
              inputMode="decimal"
              value={fields.teiler}
              onChange={(e) => setFields((p) => ({ ...p, teiler: e.target.value }))}
              placeholder="z.B. 3,7"
              disabled={submitting}
            />
          </div>
        )}
      </div>
    </div>
  )
}
