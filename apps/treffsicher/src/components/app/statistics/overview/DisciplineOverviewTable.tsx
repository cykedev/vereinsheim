"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/design2/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@vereinsheim/ui/table"
import type { OverviewTableGroup } from "@/lib/statistics/overview"
import { buildOverviewColumns, type OverviewColumn } from "./overviewColumns"
import { formatScore } from "./overviewFormatting"
import { SeriesGroupRows } from "./SeriesGroupRows"

interface Props {
  group: OverviewTableGroup
  timeZone: string
}

/**
 * Tabelle der Serien je Einheit einer Disziplin: Spalten je Serienposition, Gesamt über die übliche Serienzahl und
 * „Σ alle“ bei Extra-Serien; Einheiten mit gleich vielen Serien als Gruppe mit Ø-Zeile, aufklappbar.
 */
export function DisciplineOverviewTable({ group, timeZone }: Props) {
  const {
    scoringType,
    typicalSeriesCount,
    maxSeriesCount,
    sessionCount,
    allSeriesAverage,
    seriesGroups,
  } = group
  const columns = buildOverviewColumns(typicalSeriesCount, maxSeriesCount)
  const singleGroup = seriesGroups.length === 1

  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (seriesCount: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(seriesCount)) next.delete(seriesCount)
      else next.add(seriesCount)
      return next
    })

  const singleKey = seriesGroups[0]?.seriesCount
  const singleOpen = singleGroup && singleKey !== undefined && expanded.has(singleKey)

  return (
    // min-w-0: die Tabelle scrollt in sich, die Seite nie
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-2">
          Serien je Einheit
          <span className="text-[13px] font-normal text-muted-foreground">
            {sessionCount} {sessionCount === 1 ? "Einheit" : "Einheiten"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <div className="overflow-x-auto px-6 pb-4">
          <Table className="min-w-full text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card px-0 py-0 sm:px-0">
                  {singleGroup ? (
                    <button
                      type="button"
                      aria-expanded={singleOpen}
                      aria-label={singleOpen ? "Einheiten ausblenden" : "Einheiten anzeigen"}
                      onClick={() => singleKey !== undefined && toggle(singleKey)}
                      className="flex w-full items-center gap-1 px-2 py-2 text-left font-medium hover:text-foreground/80 sm:px-3"
                    >
                      {singleOpen ? (
                        <ChevronDown className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" aria-hidden />
                      )}
                      Einheiten
                    </button>
                  ) : (
                    <span className="block px-2 py-2 font-medium sm:px-3">Einheiten</span>
                  )}
                </TableHead>
                {columns.map((col, i) => (
                  <HeadCell key={i} column={col} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {seriesGroups.map((sg) => (
                <SeriesGroupRows
                  key={sg.seriesCount}
                  group={sg}
                  columns={columns}
                  typicalSeriesCount={typicalSeriesCount}
                  scoringType={scoringType}
                  expanded={expanded.has(sg.seriesCount)}
                  onToggle={() => toggle(sg.seriesCount)}
                  showGroupHeader={!singleGroup}
                  timeZone={timeZone}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        {allSeriesAverage !== null && (
          <p className="flex items-baseline justify-between gap-2 border-t px-6 pt-3 text-sm text-muted-foreground">
            <span>Ø aller Serien</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatScore(allSeriesAverage, scoringType)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function HeadCell({ column }: { column: OverviewColumn }) {
  const isTotal = column.kind !== "series"
  return (
    <TableHead
      className={`px-2 py-2 text-right sm:px-3 ${isTotal ? "bg-secondary/30 font-semibold" : ""}`}
    >
      <span className="hidden sm:inline">{column.label.full}</span>
      <span className="sm:hidden">{column.label.short}</span>
    </TableHead>
  )
}
