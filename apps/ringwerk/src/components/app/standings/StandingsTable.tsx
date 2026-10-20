import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import type { StandingRow } from "@/lib/standings/queries"
import { hasLeagueResult, leagueTieColumn } from "@/lib/standings/standingsSort"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { RankBadge } from "@/components/ui/rank-badge"
import { HelpMark } from "@/components/app/help/HelpMark"
import { Missing } from "@/components/app/shell/Missing"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vereinsheim/ui/table"

interface Props {
  rows: StandingRow[]
  scoringMode: ScoringMode
  scoringType: ScoringType
  /** „?“ am Spaltenkopf; die Vorschau auf Start und in der Liste zeigt keine Hilfe */
  help?: boolean
}

const ROW_HIGHLIGHT: Record<number, string> = {
  1: "bg-rank-1/10",
  2: "bg-rank-2/10",
  3: "bg-rank-3/10",
}

export function StandingsTable({ rows, scoringMode, scoringType, help = true }: Props) {
  const tie = leagueTieColumn(scoringMode)
  if (rows.length === 0) {
    return <EmptyState title="Keine Teilnehmer eingeschrieben" />
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/40">
            <TableHead className="w-10 px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              <abbr title="Platz" className="no-underline">
                Pl.
              </abbr>
            </TableHead>
            <TableHead className="px-2 py-2.5 text-left font-medium text-muted-foreground sm:px-4">
              Name
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              <abbr title="Spiele" className="no-underline">
                Sp.
              </abbr>
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              <abbr title="Siege" className="no-underline">
                S
              </abbr>
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              <abbr title="Unentschieden" className="no-underline">
                U
              </abbr>
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              <abbr title="Niederlagen" className="no-underline">
                N
              </abbr>
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-semibold sm:px-4">
              <abbr title="Punkte" className="no-underline">
                Pkt.
              </abbr>
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">
              <span className="inline-flex items-center justify-end gap-1">
                {tie.label}
                {help && tie.help && <HelpMark id={tie.help} />}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            // Podiumsfarben nur mit Ergebnis — sonst wäre vor dem ersten Duell die ganze Tabelle gold.
            const podium = hasLeagueResult(row)
            const rowHighlight =
              row.withdrawn || !podium ? "" : (ROW_HIGHLIGHT[row.rank ?? 0] ?? "")
            return (
              <TableRow
                key={row.participantId}
                className={`transition-colors ${
                  row.withdrawn ? "opacity-50" : `hover:bg-muted/20 ${rowHighlight}`
                }`}
              >
                <TableCell className="px-2 py-3 text-center sm:px-4">
                  {row.withdrawn || row.rank === null ? (
                    <Missing kind="noPlace" quiet />
                  ) : (
                    <RankBadge rank={row.rank} podium={podium} />
                  )}
                </TableCell>
                <TableCell className="px-2 py-3 font-medium whitespace-normal sm:px-4">
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
                </TableCell>
                <TableCell className="px-2 py-3 text-center font-mono text-muted-foreground tabular-nums sm:px-4">
                  {row.played}
                </TableCell>
                <TableCell className="px-2 py-3 text-center font-mono tabular-nums sm:px-4">
                  {row.wins > 0 ? (
                    <span className="font-medium text-success">{row.wins}</span>
                  ) : (
                    <span className="text-muted-foreground">{row.wins}</span>
                  )}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-center font-mono tabular-nums sm:table-cell">
                  {row.draws > 0 ? (
                    <span className="font-medium text-warning">{row.draws}</span>
                  ) : (
                    <span className="text-muted-foreground">{row.draws}</span>
                  )}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-center font-mono tabular-nums sm:table-cell">
                  <span className="text-muted-foreground">{row.losses}</span>
                </TableCell>
                <TableCell className="px-2 py-3 text-center sm:px-4">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary tabular-nums">
                    {row.points}
                  </span>
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-right font-mono text-muted-foreground tabular-nums sm:table-cell">
                  {/* ein Zurückgezogener hat keine gewerteten Duelle: dort „–“ ohne Grund wie im PDF */}
                  {tie.value(row) === null && !row.withdrawn ? (
                    <Missing kind="noDuel" className="font-sans" />
                  ) : (
                    tie.format(tie.value(row), scoringType)
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
