import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getSeasonWithSeries } from "@/lib/competitions/queries"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import { SeasonStandingsPdf } from "@/lib/pdf/SeasonStandingsPdf"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }

  const { id } = await params

  const data = await getSeasonWithSeries(id)
  if (!data) {
    return new NextResponse("Wettbewerb nicht gefunden", { status: 404 })
  }

  const { competition, participants } = data

  const standings = calculateSeasonStandings(
    participants.map((p) => ({
      participantId: p.participantId,
      participantName: `${p.lastName}, ${p.firstName}`,
      series: p.series,
    })),
    competition.minSeries,
    competition.disciplineId
  )

  const element = createElement(SeasonStandingsPdf, {
    competitionName: competition.name,
    disciplineName: competition.discipline?.name ?? null,
    seasonStart: competition.seasonStart,
    seasonEnd: competition.seasonEnd,
    scoringMode: competition.scoringMode,
    shotsPerSeries: competition.shotsPerSeries,
    minSeries: competition.minSeries,
    isMixed: !competition.disciplineId,
    entries: standings,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const slug = competition.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  const filename = `saison-${slug}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
