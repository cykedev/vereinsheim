import type { StandingRow } from "@/lib/standings/queries"
import { formatDecimal1 } from "@/lib/series/scoring-format"
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
  rows: StandingRow[]
}

const ROW_HIGHLIGHT: Record<number, string> = {
  1: "bg-rank-1/10",
  2: "bg-rank-2/10",
  3: "bg-rank-3/10",
}

export function StandingsTable({ rows }: Props) {
  if (rows.length === 0) {
    return <EmptyState title="Keine Teilnehmer eingeschrieben" />
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/40">
            <TableHead className="w-10 px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              Pl.
            </TableHead>
            <TableHead className="px-2 py-2.5 text-left font-medium text-muted-foreground sm:px-4">
              Name
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              Sp.
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              S
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              U
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              N
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-semibold sm:px-4">Pkt.</TableHead>
            <TableHead className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">
              Best. RT
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rowHighlight = row.withdrawn ? "" : (ROW_HIGHLIGHT[row.rank ?? 0] ?? "")
            return (
              <TableRow
                key={row.participantId}
                className={`transition-colors ${
                  row.withdrawn ? "opacity-50" : `hover:bg-muted/20 ${rowHighlight}`
                }`}
              >
                <TableCell className="px-2 py-3 text-center sm:px-4">
                  {row.withdrawn || row.rank === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <RankBadge rank={row.rank} />
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
                <TableCell className="px-2 py-3 text-center text-muted-foreground sm:px-4">
                  {row.played}
                </TableCell>
                <TableCell className="px-2 py-3 text-center sm:px-4">
                  {row.wins > 0 ? (
                    <span className="font-medium text-success">{row.wins}</span>
                  ) : (
                    <span className="text-muted-foreground">{row.wins}</span>
                  )}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-center sm:table-cell">
                  {row.draws > 0 ? (
                    <span className="font-medium text-warning">{row.draws}</span>
                  ) : (
                    <span className="text-muted-foreground">{row.draws}</span>
                  )}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-center sm:table-cell">
                  <span className="text-muted-foreground">{row.losses}</span>
                </TableCell>
                <TableCell className="px-2 py-3 text-center sm:px-4">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {row.points}
                  </span>
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                  {formatDecimal1(row.bestRingteiler)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
