import type { BestOfStandingRow } from "@/lib/standings/queries"
import {
  formatDirectComparison,
  type DirectComparisonTone,
} from "@/lib/standings/formatDirectComparison"
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
  rows: BestOfStandingRow[]
}

const ROW_HIGHLIGHT: Record<number, string> = {
  1: "bg-rank-1/10",
  2: "bg-rank-2/10",
  3: "bg-rank-3/10",
}

// Direktvergleich-Ton (aus formatDirectComparison) → Tailwind-Klassen.
const DIRECT_TONE_CLASS: Record<DirectComparisonTone, string> = {
  win: "font-medium text-success",
  loss: "text-muted-foreground",
  pending: "italic text-warning",
  muted: "text-muted-foreground",
}

export function BestOfStandingsTable({ rows }: Props) {
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
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              Begegn.
            </TableHead>
            <TableHead className="px-2 py-2.5 text-center font-medium text-muted-foreground sm:px-4">
              Siege
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              Satzdiff.
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-center font-medium text-muted-foreground sm:table-cell">
              Satzverhältnis
            </TableHead>
            <TableHead className="hidden px-4 py-2.5 text-right font-medium text-muted-foreground sm:table-cell">
              Direktvergleich
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rowHighlight = row.withdrawn ? "" : (ROW_HIGHLIGHT[row.rank] ?? "")
            const direct = formatDirectComparison(row.directComparison)
            return (
              <TableRow
                key={row.participantId}
                className={`transition-colors ${
                  row.withdrawn ? "opacity-50" : `hover:bg-muted/20 ${rowHighlight}`
                }`}
              >
                <TableCell className="px-2 py-3 text-center sm:px-4">
                  {row.withdrawn ? (
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
                <TableCell className="hidden px-4 py-3 text-center text-muted-foreground sm:table-cell">
                  {row.played}
                </TableCell>
                <TableCell className="px-2 py-3 text-center font-medium sm:px-4">
                  {row.wins}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-center sm:table-cell">
                  <span
                    className={
                      row.duelDiff > 0
                        ? "font-medium text-success"
                        : row.duelDiff < 0
                          ? "text-muted-foreground"
                          : "text-muted-foreground"
                    }
                  >
                    {row.duelDiff > 0 ? `+${row.duelDiff}` : row.duelDiff}
                  </span>
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-center text-muted-foreground sm:table-cell">
                  {row.duelsWon}:{row.duelsLost}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-right sm:table-cell">
                  <span className={DIRECT_TONE_CLASS[direct.tone]}>{direct.text}</span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
