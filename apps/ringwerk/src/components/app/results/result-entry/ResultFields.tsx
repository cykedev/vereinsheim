import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { RingsInput } from "@/components/app/series/RingsInput"
import type { ScoringType } from "@/generated/prisma/client"

interface Fields {
  rings: string
  teiler: string
}

interface Props {
  idPrefix: string
  name: string
  fields: Fields
  setFields: React.Dispatch<React.SetStateAction<Fields>>
  scoringType: ScoringType
  shotsPerSeries: number
  teilerFaktor: number
  teilerPlaceholder: string
}

// Eingabeblock (Gesamtringe + bester Teiler mit Korrektur-Hinweis) je Teilnehmer.
export function ResultFields({
  idPrefix,
  name,
  fields,
  setFields,
  scoringType,
  shotsPerSeries,
  teilerFaktor,
  teilerPlaceholder,
}: Props) {
  const teilerNum = parseFloat(fields.teiler.replace(",", "."))
  const correctedTeiler = isNaN(teilerNum) || teilerFaktor === 1 ? null : teilerNum * teilerFaktor

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{name}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-rings`} className="text-xs text-muted-foreground">
            Gesamtringe
          </Label>
          <RingsInput
            id={`${idPrefix}-rings`}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            value={fields.rings}
            onChange={(e) => setFields((p) => ({ ...p, rings: e.target.value }))}
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
            value={fields.teiler}
            onChange={(e) => setFields((p) => ({ ...p, teiler: e.target.value }))}
            placeholder={teilerPlaceholder}
          />
          {correctedTeiler !== null && (
            <p className="text-xs text-muted-foreground">
              Korr. Teiler: {correctedTeiler.toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
