import type { EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
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
  entries: EventTeamRankedEntry[]
  scoringMode: string
  teamScoring: "SUM" | "BEST"
}

export function EventTeamRankingTable({ entries, scoringMode, teamScoring }: Props) {
  if (entries.length === 0) {
    return <EmptyState title="Noch keine Team-Ergebnisse erfasst" />
  }

  const scoreLabel =
    SCORING_MODE_COLUMN_LABELS[scoringMode as keyof typeof SCORING_MODE_COLUMN_LABELS] ?? "Score"
  const teamScoringLabel = teamScoring === "SUM" ? "Summe" : "Bestes"

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
        <span className="text-sm font-medium">Team-Rangliste</span>
        <span className="text-xs text-muted-foreground">{teamScoringLabel}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/50">
            <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground w-10">
              Pl.
            </TableHead>
            <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground">
              Team
            </TableHead>
            <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
              Mitglieder
            </TableHead>
            <TableHead className="px-3 py-2 text-right font-medium text-muted-foreground">
              {scoreLabel}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.teamNumber} className="hover:bg-muted/30 transition-colors">
              <TableCell className="px-3 py-2">
                <RankBadge rank={entry.rank} />
              </TableCell>
              <TableCell className="px-3 py-2 font-medium">Team {entry.teamNumber}</TableCell>
              <TableCell className="px-3 py-2 text-muted-foreground hidden whitespace-normal sm:table-cell text-xs">
                {entry.members.map((m) => m.participantName).join(", ")}
              </TableCell>
              <TableCell className="px-3 py-2 text-right tabular-nums font-medium">
                {formatTeamScore(entry.teamScore, scoringMode)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function formatTeamScore(score: number, mode: string): string {
  if (mode === "TARGET_UNDER" && score >= 1e9) {
    return `+${(score - 1e9).toFixed(1)}`
  }
  if (mode === "TARGET_OVER" && score >= 1e9) {
    return `-${(score - 1e9).toFixed(1)}`
  }
  if (mode === "RINGS" || mode === "DECIMAL_REST") {
    return score.toFixed(0)
  }
  return score.toFixed(1)
}
