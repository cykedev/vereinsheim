import type { EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
import { RankBadge } from "@/components/ui/rank-badge"

interface Props {
  entries: EventTeamRankedEntry[]
  scoringMode: string
  teamScoring: "SUM" | "BEST"
}

export function EventTeamRankingTable({ entries, scoringMode, teamScoring }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Team-Ergebnisse erfasst.</p>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">Pl.</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Team</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
              Mitglieder
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry) => (
            <tr key={entry.teamNumber} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2">
                <RankBadge rank={entry.rank} />
              </td>
              <td className="px-3 py-2 font-medium">Team {entry.teamNumber}</td>
              <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell text-xs">
                {entry.members.map((m) => m.participantName).join(", ")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {formatTeamScore(entry.teamScore, scoringMode)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
