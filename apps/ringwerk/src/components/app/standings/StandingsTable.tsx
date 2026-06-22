import type { StandingRow } from "@/lib/standings/queries"
import { formatDecimal1 } from "@/lib/series/scoring-format"
import { RankBadge } from "@/components/ui/rank-badge"

interface Props {
  rows: StandingRow[]
}

const ROW_HIGHLIGHT: Record<number, string> = {
  1: "bg-yellow-400/5",
  2: "bg-slate-400/5",
  3: "bg-orange-500/5",
}

export function StandingsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Keine Teilnehmer eingeschrieben.
      </p>
    )
  }

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
            <th className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              Sp.
            </th>
            <th className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">S</th>
            <th className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              U
            </th>
            <th className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              N
            </th>
            <th className="px-2 py-2.5 text-center font-semibold sm:px-4">Pkt.</th>
            <th className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">
              Best. RT
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const rowHighlight = row.withdrawn ? "" : (ROW_HIGHLIGHT[row.rank ?? 0] ?? "")
            return (
              <tr
                key={row.participantId}
                className={`transition-colors ${
                  row.withdrawn ? "opacity-50" : `hover:bg-muted/20 ${rowHighlight}`
                }`}
              >
                <td className="px-2 py-3 text-center sm:px-4">
                  {row.withdrawn || row.rank === null ? (
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
                <td className="px-2 py-3 text-center text-muted-foreground sm:px-4">
                  {row.played}
                </td>
                <td className="px-2 py-3 text-center sm:px-4">
                  {row.wins > 0 ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {row.wins}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{row.wins}</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  {row.draws > 0 ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {row.draws}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{row.draws}</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-center sm:table-cell">
                  <span className="text-muted-foreground">{row.losses}</span>
                </td>
                <td className="px-2 py-3 text-center sm:px-4">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {row.points}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                  {formatDecimal1(row.bestRingteiler)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
