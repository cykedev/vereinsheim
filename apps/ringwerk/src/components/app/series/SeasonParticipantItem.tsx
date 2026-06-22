"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SeasonSeriesDialog } from "./SeasonSeriesDialog"
import { DeleteSeasonSeriesButton } from "./DeleteSeasonSeriesButton"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { formatRings, formatDecimal1, getEffectiveScoringType } from "@/lib/series/scoring-format"

interface Series {
  id: string
  rings: number
  teiler: number
  ringteiler: number
  sessionDate: string // formatiert vom Server (Anzeigeformat)
  sessionDateIso: string // YYYY-MM-DD für date-Input
  disciplineName?: string
  disciplineId?: string | null
}

interface Props {
  competitionId: string
  participantId: string
  firstName: string
  lastName: string
  disciplineName?: string
  series: Series[]
  minSeries: number | null
  isMixed: boolean
  scoringMode: ScoringMode
  shotsPerSeries: number
  disciplines?: { id: string; name: string; scoringType: ScoringType; teilerFaktor: number }[]
  defaultDisciplineId?: string | null
}

export function SeasonParticipantItem({
  competitionId,
  participantId,
  firstName,
  lastName,
  disciplineName,
  series,
  minSeries,
  isMixed,
  scoringMode,
  shotsPerSeries,
  disciplines,
  defaultDisciplineId,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasSeries = series.length > 0

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => hasSeries && setExpanded((v) => !v)}
          className={`min-w-0 flex-1 text-left flex items-center gap-2${hasSeries ? " cursor-pointer" : " cursor-default"}`}
        >
          {hasSeries ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {lastName}, {firstName}
              </span>
              {isMixed && disciplineName && (
                <Badge variant="secondary" className="text-xs">
                  {disciplineName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {series.length} Serie{series.length !== 1 ? "n" : ""}
              {minSeries !== null && ` / ${minSeries} Mindest`}
            </p>
          </div>
        </button>
        <SeasonSeriesDialog
          competitionId={competitionId}
          participantId={participantId}
          participantName={`${firstName} ${lastName}`}
          scoringMode={scoringMode}
          shotsPerSeries={shotsPerSeries}
          disciplines={disciplines}
          defaultDisciplineId={defaultDisciplineId}
        />
      </div>

      {expanded && hasSeries && (
        <div className="border-t bg-muted/20">
          {series.map((s) => (
            <div key={s.id} className="flex items-center justify-between pl-10 pr-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {s.sessionDate}
                  {isMixed && s.disciplineName && (
                    <span className="ml-2">· {s.disciplineName}</span>
                  )}
                </p>
                <p className="text-sm tabular-nums">
                  {formatRings(
                    s.rings,
                    getEffectiveScoringType(
                      scoringMode,
                      disciplines?.find((d) => d.id === s.disciplineId) ?? null
                    )
                  )}{" "}
                  Ringe · Teiler {formatDecimal1(s.teiler)} · RT {formatDecimal1(s.ringteiler)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <SeasonSeriesDialog
                  competitionId={competitionId}
                  participantId={participantId}
                  participantName={`${firstName} ${lastName}`}
                  scoringMode={scoringMode}
                  shotsPerSeries={shotsPerSeries}
                  disciplines={disciplines}
                  existingSeries={{
                    id: s.id,
                    rings: s.rings,
                    teiler: s.teiler,
                    sessionDate: s.sessionDateIso,
                    disciplineId: s.disciplineId,
                  }}
                />
                <DeleteSeasonSeriesButton seriesId={s.id} competitionId={competitionId} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
