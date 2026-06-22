import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { CompetitionFormState } from "./useCompetitionFormState"

interface Props {
  form: CompetitionFormState
  competition?: CompetitionDetail
}

export function SeasonFieldsSection({ form, competition }: Props) {
  const {
    isPending,
    isEdit,
    type,
    minSeries,
    setMinSeries,
    seasonStart,
    setSeasonStart,
    seasonEnd,
    setSeasonEnd,
  } = form

  if (!(type === "SEASON" || (isEdit && competition?.type === "SEASON"))) return null

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="minSeries">Mindestserien (optional)</Label>
        <Input
          id="minSeries"
          name="minSeries"
          type="number"
          min={1}
          max={999}
          value={minSeries}
          onChange={(e) => setMinSeries(e.target.value)}
          placeholder="z.B. 20"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Teilnehmer mit weniger Serien werden in der Rangliste ausgegraut.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="seasonStart">Saisonbeginn (optional)</Label>
        <Input
          id="seasonStart"
          name="seasonStart"
          type="date"
          value={seasonStart}
          onChange={(e) => setSeasonStart(e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="seasonEnd">Saisonende (optional)</Label>
        <Input
          id="seasonEnd"
          name="seasonEnd"
          type="date"
          value={seasonEnd}
          onChange={(e) => setSeasonEnd(e.target.value)}
          disabled={isPending}
        />
      </div>
    </>
  )
}
