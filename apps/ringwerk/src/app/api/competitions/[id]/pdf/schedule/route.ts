import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getMatchupsForCompetition } from "@/lib/matchups/queries"
import {
  getStandingsForCompetition,
  getBestOfStandingsForCompetition,
} from "@/lib/standings/queries"
import { SchedulePdf } from "@/lib/pdf/SchedulePdf"
import { BestOfSchedulePdf } from "@/lib/pdf/BestOfSchedulePdf"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }

  const { id } = await params

  const competition = await getCompetitionById(id)
  if (!competition) {
    return new NextResponse("Wettbewerb nicht gefunden", { status: 404 })
  }

  const isBestOf = competition.leagueFormat === "BEST_OF_SINGLE"

  const [standingsClassic, standingsBestOf, matchups] = await Promise.all([
    isBestOf ? Promise.resolve([]) : getStandingsForCompetition(id),
    isBestOf ? getBestOfStandingsForCompetition(id) : Promise.resolve([]),
    getMatchupsForCompetition(id),
  ])

  const scoringType = getEffectiveScoringType(competition.scoringMode, competition.discipline)
  const disciplineName = competition.discipline?.name ?? "Gemischt"

  let element: ReactElement<DocumentProps>
  if (isBestOf) {
    element = createElement(BestOfSchedulePdf, {
      leagueName: competition.name,
      disciplineName,
      scoringType,
      scoringMode: competition.scoringMode,
      disciplineId: competition.disciplineId,
      groupBestOf: competition.groupBestOf ?? 3,
      groupPlayAllDuels: competition.groupPlayAllDuels,
      groupTiebreaker1: competition.groupTiebreaker1,
      groupTiebreaker2: competition.groupTiebreaker2,
      standings: standingsBestOf,
      matchups,
      generatedAt: new Date(),
    }) as ReactElement<DocumentProps>
  } else {
    element = createElement(SchedulePdf, {
      leagueName: competition.name,
      disciplineName,
      scoringType,
      standings: standingsClassic,
      matchups,
      firstLegDeadline: competition.hinrundeDeadline,
      secondLegDeadline: competition.rueckrundeDeadline,
      generatedAt: new Date(),
    }) as ReactElement<DocumentProps>
  }

  const buffer = await renderToBuffer(element)

  const slug = competition.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  const filename = `spielplan-${slug}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
