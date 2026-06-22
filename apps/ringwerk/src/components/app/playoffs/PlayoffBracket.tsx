import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import type { PlayoffBracketData } from "@/lib/playoffs/types"
import {
  BracketDetails,
  BracketDiagram,
  computeBracketLayout,
  computePreviews,
} from "./playoff-bracket"
import type { PlayoffCardConfig } from "./playoff-match-card"

interface Props {
  bracket: PlayoffBracketData
  canManage: boolean
  /** Nur visuelles Bracket, keine Detail-Karten */
  compact?: boolean
  scoringType: ScoringType
  shotsPerSeries: number
  playoffBestOf?: number | null
  finalePrimary?: ScoringMode
  finaleTiebreaker1?: ScoringMode | null
  finaleTiebreaker2?: ScoringMode | null
}

export function PlayoffBracket({
  bracket,
  canManage,
  compact = false,
  scoringType,
  shotsPerSeries,
  playoffBestOf = null,
  finalePrimary = "RINGS",
  finaleTiebreaker1 = null,
  finaleTiebreaker2 = null,
}: Props) {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf } = bracket
  const isAF = af.length > 0
  const isVF = !isAF && qf.length > 0

  if (!isAF && !isVF && hf.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Die Playoff-Paarungen werden nach dem Start angezeigt.
      </p>
    )
  }

  const layout = computeBracketLayout(isAF, isVF)
  const { qfPreviews, hfPreviews, finalPreview } = computePreviews(bracket, isAF, isVF)

  const config: PlayoffCardConfig = {
    scoringType,
    shotsPerSeries,
    playoffBestOf,
    finalePrimary,
    finaleTiebreaker1,
    finaleTiebreaker2,
  }

  return (
    <div className="space-y-8">
      <BracketDiagram
        bracket={bracket}
        layout={layout}
        isAF={isAF}
        isVF={isVF}
        qfPreviews={qfPreviews}
        hfPreviews={hfPreviews}
        finalPreview={finalPreview}
      />

      {!compact && (
        <BracketDetails
          bracket={bracket}
          isAF={isAF}
          isVF={isVF}
          canManage={canManage}
          config={config}
        />
      )}
    </div>
  )
}
