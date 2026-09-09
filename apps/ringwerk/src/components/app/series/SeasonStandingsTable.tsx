"use client"

import { useState } from "react"
import { ChevronUp } from "lucide-react"
import {
  isAlternatingSort,
  SEASON_SORT_LABELS,
  sortSeasonStandings,
  type ResolvedSeasonSort,
  type SortedSeasonStandingsEntry,
} from "@/lib/scoring/sortSeasonStandings"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
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

/** Die drei manuell sortierbaren Spalten — nur in den klassischen Modi anklickbar. */
type SortCol = "rings" | "teiler" | "ringteiler"

const HEAD_CLASS = "px-3 py-2 text-right font-medium text-muted-foreground"

function SortHeader({
  col,
  label,
  className,
  sortCol,
  setSortCol,
}: {
  col: SortCol
  label: string
  className?: string
  sortCol: SortCol
  setSortCol: (col: SortCol) => void
}) {
  const active = sortCol === col
  return (
    <TableHead
      className={`${HEAD_CLASS} cursor-pointer select-none hover:text-foreground transition-colors${active ? " text-foreground" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => setSortCol(col)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active && <ChevronUp className="h-3 w-3" />}
      </span>
    </TableHead>
  )
}

/** Nicht klickbarer Spaltenkopf: in den alternierenden Modi ergibt manuelles Sortieren keinen Sinn. */
function StaticHead({ label, className }: { label: string; className?: string }) {
  return (
    <TableHead className={`${HEAD_CLASS}${className ? ` ${className}` : ""}`}>{label}</TableHead>
  )
}

/**
 * Hebt in den alternierenden Modi den Wert hervor, der die Zeile auf ihren Platz gebracht hat,
 * und nimmt die übrigen zurück. In den klassischen Modi bleibt die Darstellung unverändert.
 */
function metricEmphasis(entry: SortedSeasonStandingsEntry, metric: SortCol): string {
  if (entry.alternatingBy === null) return ""
  return entry.alternatingBy === metric ? "font-medium text-foreground" : "text-muted-foreground"
}

interface Props {
  entries: SortedSeasonStandingsEntry[]
  minSeries: number | null
  /** Aufgelöste Sortierung des Wettbewerbs — bestimmt Default-Spalte bzw. die feste Reihenfolge. */
  sort: ResolvedSeasonSort
  isMixed?: boolean
}

export function SeasonStandingsTable({ entries, minSeries, sort, isMixed = false }: Props) {
  const alternating = isAlternatingSort(sort)
  const [sortCol, setSortCol] = useState<SortCol>(
    sort === "rings" || sort === "teiler" ? sort : "ringteiler"
  )

  if (entries.length === 0) {
    return <EmptyState title="Noch keine Serien erfasst" />
  }

  // Alternierend: die Reihenfolge kommt aus der Wertung selbst und bleibt wie geliefert.
  const sorted = alternating ? entries : sortSeasonStandings(entries, sortCol)
  const teilerLabel = isMixed ? "Best. Teiler korr." : "Best. Teiler"

  return (
    <div className="space-y-2">
      {alternating && (
        <p className="text-sm text-muted-foreground">
          Sortierung: {SEASON_SORT_LABELS[sort]} — hervorgehoben ist der Wert, der den Platz ergeben
          hat.
        </p>
      )}
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/50">
              <TableHead className="px-3 py-2 text-left font-medium text-muted-foreground">
                Name
              </TableHead>
              {minSeries !== null && (
                <TableHead className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">
                  Serien
                </TableHead>
              )}
              {alternating ? (
                <>
                  <StaticHead label="Beste Ringe" />
                  <StaticHead label={teilerLabel} className="hidden sm:table-cell" />
                  <StaticHead label="Best. Ringteiler" />
                </>
              ) : (
                <>
                  <SortHeader
                    col="rings"
                    label="Beste Ringe"
                    sortCol={sortCol}
                    setSortCol={setSortCol}
                  />
                  <SortHeader
                    col="teiler"
                    label={teilerLabel}
                    className="hidden sm:table-cell"
                    sortCol={sortCol}
                    setSortCol={setSortCol}
                  />
                  <SortHeader
                    col="ringteiler"
                    label="Best. Ringteiler"
                    sortCol={sortCol}
                    setSortCol={setSortCol}
                  />
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((entry, idx) => {
              const qualified = entry.meetsMinSeries
              return (
                <TableRow key={entry.participantId} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="px-3 py-2 font-medium whitespace-normal">
                    <span className="inline-flex items-center gap-1.5">
                      <RankBadge rank={idx + 1} />
                      <span className={qualified ? "" : "text-muted-foreground"}>
                        {entry.participantName}
                        {!qualified && minSeries !== null && (
                          <span className="ml-1.5 text-xs sm:hidden">
                            ({entry.seriesCount}/{minSeries})
                          </span>
                        )}
                      </span>
                    </span>
                  </TableCell>
                  {minSeries !== null && (
                    <TableCell className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                      <span className={qualified ? "text-success" : "text-destructive"}>
                        {entry.seriesCount}/{minSeries}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2 tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.bestRings !== null ? (
                        <>
                          <span className={metricEmphasis(entry, "rings")}>
                            {formatRings(entry.bestRings, entry.bestRingsScoringType ?? "WHOLE")}
                          </span>
                          <RankBadge rank={entry.bestRings_rank ?? idx + 1} />
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums hidden sm:table-cell">
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.bestCorrectedTeiler !== null ? (
                        <>
                          <span className={metricEmphasis(entry, "teiler")}>
                            {formatDecimal1(entry.bestCorrectedTeiler)}
                          </span>
                          <RankBadge rank={entry.bestTeiler_rank ?? idx + 1} />
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums font-medium">
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.bestRingteiler !== null ? (
                        <>
                          <span className={metricEmphasis(entry, "ringteiler")}>
                            {formatDecimal1(entry.bestRingteiler)}
                          </span>
                          <RankBadge rank={entry.bestRingteiler_rank ?? idx + 1} />
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
