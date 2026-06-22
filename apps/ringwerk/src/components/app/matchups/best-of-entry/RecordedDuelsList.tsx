import { duelOutcome, stechschussOutcome } from "@/lib/scoring/bestOf"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import type { MatchResultSummary } from "@/lib/matchups/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"

interface Props {
  homeId: string
  awayId: string
  series: MatchResultSummary[]
  duelNumbers: number[]
  stechschussNumbers: number[]
  disciplineId: string | null
  scoringMode: ScoringMode
  scoringType: ScoringType
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
}

// Liste der bereits erfassten regulären Duelle und Stechschüsse.
export function RecordedDuelsList({
  homeId,
  awayId,
  series,
  duelNumbers,
  stechschussNumbers,
  disciplineId,
  scoringMode,
  scoringType,
  groupTiebreaker1,
  groupTiebreaker2,
}: Props) {
  if (duelNumbers.length === 0) return null

  return (
    <div className="divide-y divide-border rounded-md border text-xs">
      {duelNumbers.map((dn) => {
        const homeS = series.find(
          (s) => s.participantId === homeId && s.duelNumber === dn && !s.isTiebreak
        )
        const awayS = series.find(
          (s) => s.participantId === awayId && s.duelNumber === dn && !s.isTiebreak
        )
        const outcome =
          homeS && awayS
            ? duelOutcome(
                {
                  rings: homeS.rings,
                  correctedTeiler: homeS.teiler * effectiveTeilerFaktor(disciplineId, 1),
                  ringteiler: homeS.ringteiler,
                },
                {
                  rings: awayS.rings,
                  correctedTeiler: awayS.teiler * effectiveTeilerFaktor(disciplineId, 1),
                  ringteiler: awayS.ringteiler,
                },
                scoringMode,
                groupTiebreaker1,
                groupTiebreaker2
              )
            : null

        return (
          <div key={dn} className="flex items-center gap-2 px-2 py-2 sm:px-3">
            <span className="w-16 shrink-0 text-muted-foreground">Duell {dn}</span>
            {homeS && awayS ? (
              <>
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-right tabular-nums ${outcome === "A" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {formatRings(homeS.rings, scoringType)}&nbsp;R&nbsp;·&nbsp;
                  {formatDecimal1(homeS.teiler)}&nbsp;T
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {outcome === "A" ? "▸" : outcome === "B" ? "◂" : "="}
                </span>
                <span
                  className={`min-w-0 flex-1 overflow-hidden tabular-nums ${outcome === "B" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {formatRings(awayS.rings, scoringType)}&nbsp;R&nbsp;·&nbsp;
                  {formatDecimal1(awayS.teiler)}&nbsp;T
                </span>
              </>
            ) : (
              <span className="flex-1 text-muted-foreground">Unvollständig</span>
            )}
          </div>
        )
      })}

      {/* Recorded Stechschuss rounds */}
      {stechschussNumbers.map((dn) => {
        const homeS = series.find(
          (s) => s.participantId === homeId && s.duelNumber === dn && s.isTiebreak
        )
        const awayS = series.find(
          (s) => s.participantId === awayId && s.duelNumber === dn && s.isTiebreak
        )
        const outcome = homeS && awayS ? stechschussOutcome(homeS.rings, awayS.rings) : null

        return (
          <div key={`tb-${dn}`} className="flex items-center gap-2 px-2 py-2 sm:px-3">
            <span className="w-16 shrink-0 text-muted-foreground">Stech.</span>
            {homeS && awayS ? (
              <>
                <span
                  className={`min-w-0 flex-1 overflow-hidden text-right tabular-nums ${outcome === "A" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {homeS.rings.toFixed(1).replace(".", ",")}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {outcome === "A" ? "▸" : outcome === "B" ? "◂" : "="}
                </span>
                <span
                  className={`min-w-0 flex-1 overflow-hidden tabular-nums ${outcome === "B" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {awayS.rings.toFixed(1).replace(".", ",")}
                </span>
              </>
            ) : (
              <span className="flex-1 text-muted-foreground">Unvollständig</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
