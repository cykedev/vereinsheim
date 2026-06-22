import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { CompetitionFormState } from "./useCompetitionFormState"
import { LeagueGroupPhaseFieldset } from "./LeagueGroupPhaseFieldset"
import { LeaguePlayoffsFieldset } from "./LeaguePlayoffsFieldset"

interface Props {
  form: CompetitionFormState
  competition?: CompetitionDetail
  hasMatchups: boolean
  playoffsStarted: boolean
}

export function LeagueFieldsSection({ form, competition, hasMatchups, playoffsStarted }: Props) {
  const {
    isPending,
    isEdit,
    type,
    isBestOfSingle,
    hinrundeDeadline,
    setHinrundeDeadline,
    rueckrundeDeadline,
    setRueckrundeDeadline,
  } = form

  if (!(type === "LEAGUE" || (isEdit && competition?.type === "LEAGUE"))) return null

  return (
    <>
      {/* Stichtage: nur für Doppelrunde (Hin-/Rückrunde) sinnvoll, nicht für BEST_OF_SINGLE */}
      {!isBestOfSingle && (
        <>
          <div className="space-y-2">
            <Label htmlFor="hinrundeDeadline">Hinrunde-Stichtag (optional)</Label>
            <Input
              id="hinrundeDeadline"
              name="hinrundeDeadline"
              type="date"
              value={hinrundeDeadline}
              onChange={(e) => setHinrundeDeadline(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rueckrundeDeadline">Rückrunde-Stichtag (optional)</Label>
            <Input
              id="rueckrundeDeadline"
              name="rueckrundeDeadline"
              type="date"
              value={rueckrundeDeadline}
              onChange={(e) => setRueckrundeDeadline(e.target.value)}
              disabled={isPending}
            />
          </div>
        </>
      )}

      {/* ── Regelset ──────────────────────────────────────────── */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Regelset</p>
        <LeagueGroupPhaseFieldset form={form} hasMatchups={hasMatchups} />
        <LeaguePlayoffsFieldset form={form} playoffsStarted={playoffsStarted} />
      </div>
    </>
  )
}
