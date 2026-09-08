import type { EventRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
import { formatRings, formatDecimal1, getEffectiveScoringType } from "@/lib/series/scoring-format"
import type { ScoringMode, TargetValueType } from "@/generated/prisma/client"
import { Badge } from "@vereinsheim/ui/badge"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { RankBadge } from "@/components/ui/rank-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vereinsheim/ui/table"

interface Props {
  entries: EventRankedEntry[]
  scoringMode: ScoringMode
  targetValueType?: TargetValueType | null
  isMixed?: boolean
  showTeam?: boolean
}

export function EventRankingTable({
  entries,
  scoringMode,
  targetValueType,
  isMixed = false,
  showTeam = false,
}: Props) {
  if (entries.length === 0) {
    return <EmptyState title="Noch keine Ergebnisse erfasst" />
  }

  const scoreLabel = SCORING_MODE_COLUMN_LABELS[scoringMode] ?? "Score"

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/50">
            <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground w-10">
              Pl.
            </TableHead>
            <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground">
              Name
            </TableHead>
            <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
              Disziplin
            </TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-muted-foreground">
              Ringe
            </TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">
              {isMixed ? "Teiler korr." : "Teiler"}
            </TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-muted-foreground">
              {scoreLabel}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.seriesId} className="hover:bg-muted/30 transition-colors">
              <TableCell className="px-3 py-2">
                <RankBadge rank={entry.rank} />
              </TableCell>
              <TableCell className="px-3 py-2 font-medium whitespace-normal">
                <span className="flex items-center gap-1.5 flex-wrap">
                  {entry.participantName}
                  {entry.isGuest && (
                    <Badge variant="outline" className="text-xs">
                      Gast
                    </Badge>
                  )}
                  {showTeam && entry.teamNumber != null && (
                    <Badge variant="secondary" className="text-xs">
                      T{entry.teamNumber}
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden whitespace-normal sm:table-cell">
                {entry.disciplineName}
              </TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums">
                {formatRings(
                  entry.rings,
                  getEffectiveScoringType(
                    scoringMode,
                    { scoringType: entry.disciplineScoringType },
                    targetValueType
                  )
                )}
              </TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {formatDecimal1(isMixed ? entry.correctedTeiler : entry.teiler)}
              </TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums font-medium">
                {formatScore(entry.score, scoringMode)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function formatScore(score: number, mode: ScoringMode): string {
  if (mode === "TARGET_UNDER" && score >= 1e9) {
    return `+${(score - 1e9).toFixed(1).replace(".", ",")}`
  }
  if (mode === "TARGET_OVER" && score >= 1e9) {
    return `-${(score - 1e9).toFixed(1).replace(".", ",")}`
  }
  if (mode === "RINGS" || mode === "DECIMAL_REST") {
    return score.toFixed(0)
  }
  return score.toFixed(1).replace(".", ",")
}
