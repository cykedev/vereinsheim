import type { ScoringMode } from "@/generated/prisma/client"
import type { BestOfStandingRow } from "@/lib/standings/queries"
import { formatDecimal1, formatRings } from "@/lib/series/scoring-format"
import { RankBadge } from "@/components/ui/rank-badge"

interface Props {
  rows: BestOfStandingRow[]
  scoringMode: ScoringMode
}

const ROW_HIGHLIGHT: Record<number, string> = {
  1: "bg-yellow-400/5",
  2: "bg-slate-400/5",
  3: "bg-orange-500/5",
}

export function BestOfStandingsTable({ rows, scoringMode }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Keine Teilnehmer eingeschrieben.
      </p>
    )
  }

  // RINGS / RINGS_DECIMAL modes rank by best rings (higher = better); show rings column.
  // All other modes rank by best Ringteiler (lower = better); show Ringteiler column.
  const showRings = scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL"
  // RINGS_DECIMAL uses decimal display ("96,5"); RINGS uses integer ("96").
  const scoringType = scoringMode === "RINGS_DECIMAL" ? "DECIMAL" : "WHOLE"

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="w-10 px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              Pl.
            </th>
            <th className="px-2 py-2.5 text-left font-medium text-muted-foreground sm:px-4">
              Name
            </th>
            <th className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              Begegn.
            </th>
            <th className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              Siege
            </th>
            <th className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              Satzdiff.
            </th>
            <th className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              Satzverhältnis
            </th>
            <th className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">
              {showRings ? "Best. Ringe" : "Best. RT"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const rowHighlight = row.withdrawn ? "" : (ROW_HIGHLIGHT[row.rank] ?? "")
            return (
              <tr
                key={row.participantId}
                className={`transition-colors ${
                  row.withdrawn ? "opacity-50" : `hover:bg-muted/20 ${rowHighlight}`
                }`}
              >
                <td className="px-2 py-3 text-center sm:px-4">
                  {row.withdrawn ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <RankBadge rank={row.rank} />
                  )}
                </td>
                <td className="px-2 py-3 font-medium sm:px-4">
                  {row.withdrawn ? (
                    <span className="line-through text-muted-foreground">
                      {row.lastName}, {row.firstName}
                      <span className="ml-2 text-xs not-italic no-underline">(Zurückgezogen)</span>
                    </span>
                  ) : (
                    <>
                      {row.lastName}, {row.firstName}
                    </>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-center text-muted-foreground sm:table-cell">
                  {row.played}
                </td>
                <td className="px-2 py-3 text-center font-medium sm:px-4">{row.wins}</td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  <span
                    className={
                      row.duelDiff > 0
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : row.duelDiff < 0
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                    }
                  >
                    {row.duelDiff > 0 ? `+${row.duelDiff}` : row.duelDiff}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-center text-muted-foreground sm:table-cell">
                  {row.duelsWon}:{row.duelsLost}
                </td>
                <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                  {showRings
                    ? formatRings(row.bestRings, scoringType)
                    : formatDecimal1(row.bestRingteiler)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
