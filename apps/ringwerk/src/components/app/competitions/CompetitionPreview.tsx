import Link from "next/link"
import { Trophy } from "lucide-react"
import { Badge } from "@vereinsheim/ui/badge"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { BestOfStandingsTable } from "@/components/app/standings/BestOfStandingsTable"
import { PlayoffBracket } from "@/components/app/playoffs/PlayoffBracket"
import { EventRankingTable } from "@/components/app/series/EventRankingTable"
import { EventTeamRankingTable } from "@/components/app/series/EventTeamRankingTable"
import { SeasonStandingsTable } from "@/components/app/series/SeasonStandingsTable"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import {
  PREVIEW_ROWS,
  previewEmptyText,
  previewIsEmpty,
  previewMoreCount,
  type CompetitionPreview,
} from "@/lib/competitions/previewModel"

interface Props {
  preview: CompetitionPreview
}

/** Badges, die nur die Vorschau kennt: „Playoffs" (Liga nach Start) bzw. „Teams" (Team-Event). */
export function CompetitionPreviewBadges({ preview }: Props) {
  if (preview.kind === "league" && preview.playoffsStarted) {
    return (
      <Badge variant="outline" className="text-xs">
        <Trophy className="mr-1 h-3 w-3" />
        Playoffs
      </Badge>
    )
  }
  if (preview.kind === "event" && preview.isTeamEvent) {
    return (
      <Badge variant="outline" className="text-xs">
        Teams
      </Badge>
    )
  }
  return null
}

/**
 * Die gekürzte Tabelle bzw. das Playoff-Bracket einer Wettbewerbskarte, darunter der Hinweis auf
 * die übrigen Zeilen. Leer ist es eine Zeile Text und bewusst keine `EmptyState`-Karte: die stünde
 * als Rahmen im Rahmen der Karte.
 */
export function CompetitionPreviewSection({ preview }: Props) {
  const moreCount = previewMoreCount(preview)
  return (
    <div className="space-y-2">
      {previewIsEmpty(preview) ? (
        <p className="py-2 text-sm text-muted-foreground">{previewEmptyText(preview)}</p>
      ) : (
        <PreviewTable preview={preview} />
      )}
      {moreCount != null && moreCount > 0 && (
        <p className="text-sm text-muted-foreground">
          + {moreCount} weitere{" "}
          <Link href={preview.href} className="underline hover:no-underline">
            anzeigen
          </Link>
        </p>
      )}
    </div>
  )
}

function PreviewTable({ preview }: Props) {
  const c = preview.competition

  if (preview.kind === "league") {
    if (preview.playoffsStarted) {
      return (
        <PlayoffBracket
          bracket={preview.bracket}
          canManage={false}
          compact={true}
          scoringType={getEffectiveScoringType(c.scoringMode, c.discipline)}
          shotsPerSeries={c.shotsPerSeries}
        />
      )
    }
    return preview.isBestOf ? (
      <BestOfStandingsTable rows={preview.bestOfStandings.slice(0, PREVIEW_ROWS)} />
    ) : (
      <StandingsTable rows={preview.standings.slice(0, PREVIEW_ROWS)} />
    )
  }

  if (preview.kind === "event") {
    return preview.isTeamEvent ? (
      <EventTeamRankingTable
        entries={preview.teamRanked.slice(0, PREVIEW_ROWS)}
        scoringMode={c.scoringMode}
        teamScoring={c.teamScoring ?? "SUM"}
      />
    ) : (
      <EventRankingTable
        entries={preview.ranked.slice(0, PREVIEW_ROWS)}
        scoringMode={c.scoringMode}
        targetValueType={c.targetValueType}
        isMixed={!c.discipline}
      />
    )
  }

  return (
    <SeasonStandingsTable
      key={c.id}
      entries={preview.standings.slice(0, PREVIEW_ROWS)}
      minSeries={preview.minSeries}
      sort={preview.sort}
      isMixed={!c.discipline}
    />
  )
}
