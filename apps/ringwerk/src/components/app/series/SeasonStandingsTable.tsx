"use client"

import { useState } from "react"
import { ChevronUp } from "lucide-react"
import {
  hasSeasonResult,
  isAlternatingSort,
  isPodiumRank,
  metricAppearance,
  SEASON_SORT_LABELS,
  seasonPositions,
  sortSeasonStandings,
  type MetricAppearance,
  type ResolvedSeasonSort,
  type SortedSeasonStandingsEntry,
} from "@/lib/scoring/sortSeasonStandings"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import { cn } from "@vereinsheim/lib/utils"
import { EmptyState } from "@vereinsheim/ui/empty-state"
import { RankBadge } from "@/components/ui/rank-badge"
import { HelpMark } from "@/components/app/help/HelpMark"
import { Missing } from "@/components/app/shell/Missing"
import type { HelpTopicId } from "@/lib/help/topics"
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
  help,
  className,
  sortCol,
  setSortCol,
}: {
  col: SortCol
  label: string
  /** Erklärung hinter dem „?“ am Spaltenkopf; ein Tipp darauf ordnet nicht um */
  help?: HelpTopicId
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
        {help && <HelpMark id={help} />}
      </span>
    </TableHead>
  )
}

/** Nicht klickbarer Spaltenkopf: in den alternierenden Modi ergibt manuelles Sortieren keinen Sinn. */
function StaticHead({
  label,
  help,
  className,
}: {
  label: string
  help?: HelpTopicId
  className?: string
}) {
  return (
    <TableHead className={`${HEAD_CLASS}${className ? ` ${className}` : ""}`}>
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {help && <HelpMark id={help} />}
      </span>
    </TableHead>
  )
}

/**
 * Inline-Platzierung einer Metrik: nur die Podiumsplätze (Regel in sortSeasonStandings, damit
 * Tabelle und PDF nicht auseinanderlaufen). Ohne Badge bleibt die Breite als Platzhalter stehen,
 * sonst rutschen die Zahlen der Podiumszeilen gegenüber den übrigen nach links.
 */
function MetricRank({ rank }: { rank: number | null }) {
  if (!isPodiumRank(rank)) return <span className="w-[1.25rem] shrink-0" aria-hidden />
  return <RankBadge rank={rank!} />
}

const APPEARANCE_CLASS: Record<MetricAppearance, string> = {
  emphasized: "font-medium text-foreground",
  muted: "text-muted-foreground",
  default: "",
}

interface Props {
  entries: SortedSeasonStandingsEntry[]
  minSeries: number | null
  /** Aufgelöste Sortierung des Wettbewerbs — bestimmt Default-Spalte bzw. die feste Reihenfolge. */
  sort: ResolvedSeasonSort
  isMixed?: boolean
  /** „?“ und die Zeile „Sortierung“ der klassischen Reihenfolge; die Vorschau auf Start und in der Liste zeigt sie nicht */
  help?: boolean
}

export function SeasonStandingsTable({
  entries,
  minSeries,
  sort,
  isMixed = false,
  help = true,
}: Props) {
  const alternating = isAlternatingSort(sort)
  const [sortCol, setSortCol] = useState<SortCol>(
    sort === "rings" || sort === "teiler" ? sort : "ringteiler"
  )

  if (entries.length === 0) {
    return <EmptyState title="Noch keine Serien erfasst" />
  }

  // Alternierend: die Reihenfolge kommt aus der Wertung selbst und bleibt wie geliefert.
  const sorted = alternating ? entries : sortSeasonStandings(entries, sortCol)
  // Geteilter Platz, wo nur noch der Name trennt — dieselbe Quelle wie im PDF.
  const positions = seasonPositions(sorted, alternating ? sort : sortCol)
  const teilerLabel = isMixed ? "Best. Teiler korr." : "Best. Teiler"
  // in gemischten Wettbewerben zählt der korrigierte Teiler, das „?“ erklärt die Korrektur
  const teilerHelp: HelpTopicId | undefined = help
    ? isMixed
      ? "corrected-teiler"
      : "teiler"
    : undefined
  const ringteilerHelp: HelpTopicId | undefined = help ? "ringteiler" : undefined

  // Auf dem Telefon ist neben dem Namen Platz für ZWEI Zahlenspalten. Sichtbar bleiben muss die,
  // die die Reihenfolge bestimmt: bei alternierender Sortierung Ringe UND Teiler, bei klassischer
  // Teiler-Wertung der Teiler. Die jeweils unbeteiligte Spalte klappt weg — sonst stünde der
  // maßgebliche Wert mobil in einer unsichtbaren Spalte.
  const teilerMatters = alternating || sortCol === "teiler"
  const HIDE_ON_MOBILE = "hidden sm:table-cell"
  const teilerHidden = teilerMatters ? undefined : HIDE_ON_MOBILE
  const ringteilerHidden = teilerMatters ? HIDE_ON_MOBILE : undefined

  return (
    <div className="space-y-2">
      {alternating ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Sortierung: {SEASON_SORT_LABELS[sort]} — hervorgehoben ist der Wert, der den Platz
            ergeben hat.
          </span>
          {help && <HelpMark id="season-alternating" className="ml-auto" />}
        </p>
      ) : (
        help && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Sortierung: {SEASON_SORT_LABELS[sortCol]}.</span>
            <HelpMark id="season-order" className="ml-auto" />
          </p>
        )
      )}
      <div className="overflow-hidden rounded-2xl border bg-card">
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
                  <StaticHead label={teilerLabel} help={teilerHelp} className={teilerHidden} />
                  <StaticHead
                    label="Best. Ringteiler"
                    help={ringteilerHelp}
                    className={ringteilerHidden}
                  />
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
                    help={teilerHelp}
                    className={teilerHidden}
                    sortCol={sortCol}
                    setSortCol={setSortCol}
                  />
                  <SortHeader
                    col="ringteiler"
                    label="Best. Ringteiler"
                    help={ringteilerHelp}
                    className={ringteilerHidden}
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
                      <RankBadge rank={positions[idx]} podium={hasSeasonResult(entry)} />
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
                    <TableCell className="px-3 py-2 text-right font-mono tabular-nums hidden sm:table-cell">
                      <span className={qualified ? "text-success" : "text-destructive"}>
                        {entry.seriesCount}/{minSeries}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2 font-mono tabular-nums">
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.bestRings !== null ? (
                        <>
                          <span className={APPEARANCE_CLASS[metricAppearance(entry, "rings")]}>
                            {formatRings(entry.bestRings, entry.bestRingsScoringType ?? "WHOLE")}
                          </span>
                          <MetricRank rank={entry.bestRings_rank} />
                        </>
                      ) : (
                        <Missing kind="noSeries" className="font-sans" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={cn("px-3 py-2 font-mono tabular-nums", teilerHidden)}>
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.bestCorrectedTeiler !== null ? (
                        <>
                          <span className={APPEARANCE_CLASS[metricAppearance(entry, "teiler")]}>
                            {formatDecimal1(entry.bestCorrectedTeiler)}
                          </span>
                          <MetricRank rank={entry.bestTeiler_rank} />
                        </>
                      ) : (
                        <Missing kind="noSeries" quiet />
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "px-3 py-2 font-mono tabular-nums",
                      !alternating && "font-medium",
                      ringteilerHidden
                    )}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.bestRingteiler !== null ? (
                        <>
                          <span className={APPEARANCE_CLASS[metricAppearance(entry, "ringteiler")]}>
                            {formatDecimal1(entry.bestRingteiler)}
                          </span>
                          <MetricRank rank={entry.bestRingteiler_rank} />
                        </>
                      ) : (
                        <Missing kind="noSeries" quiet />
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
