import { type NextRequest, NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import bcrypt from "bcryptjs"
import { SLUG_REGEX } from "@/lib/competitions/publicSlug"
import { resolveSlug } from "@/lib/competitions/publicSlugQueries"
import { hasPlayoffsStarted, getPlayoffBracket } from "@/lib/playoffs/queries"
import {
  getCompetitionById,
  getEventWithSeries,
  getSeasonWithSeries,
} from "@/lib/competitions/queries"
import { getMatchupsForCompetition } from "@/lib/matchups/queries"
import {
  getStandingsForCompetition,
  getBestOfStandingsForCompetition,
} from "@/lib/standings/queries"
import { rankEventParticipants, rankEventTeams } from "@/lib/scoring/rankEventParticipants"
import { calculateSeasonStandings } from "@/lib/scoring/calculateSeasonStandings"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import { EventRankingPdf } from "@/lib/pdf/EventRankingPdf"
import { SeasonStandingsPdf } from "@/lib/pdf/SeasonStandingsPdf"
import { SchedulePdf } from "@/lib/pdf/SchedulePdf"
import { BestOfSchedulePdf } from "@/lib/pdf/BestOfSchedulePdf"
import { PlayoffsPdf } from "@/lib/pdf/PlayoffsPdf"

// The auth check must run on every request, so we cannot use route-level revalidate.
// The expensive PDF render is cached separately via unstable_cache (see renderPdfBuffer).
export const dynamic = "force-dynamic"

type PhaseTag = "ranking" | "standings" | "schedule" | "playoffs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params

  // Defensive: malformed slug → 404 immediately, do not hit DB
  if (!SLUG_REGEX.test(slug)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const competition = await resolveSlug(slug)
  if (!competition) {
    return new NextResponse("Not Found", { status: 404 })
  }

  // === Password check ===================================================
  if (competition.publicPasswordHash) {
    const authHeader = req.headers.get("authorization")
    const provided = parseBasicAuthPassword(authHeader)
    const ok = provided != null && (await bcrypt.compare(provided, competition.publicPasswordHash))
    if (!ok) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: {
          "WWW-Authenticate": `Basic realm="${escapeRealm(competition.name)}", charset="UTF-8"`,
        },
      })
    }
  }

  // === Pick PDF type and render =========================================
  let phaseTag: PhaseTag
  if (competition.type === "EVENT") {
    phaseTag = "ranking"
  } else if (competition.type === "SEASON") {
    phaseTag = "standings"
  } else if (competition.type === "LEAGUE") {
    phaseTag = (await hasPlayoffsStarted(competition.id)) ? "playoffs" : "schedule"
  } else {
    return new NextResponse("Not Found", { status: 404 })
  }

  const buffer = await renderPdfBuffer(competition.id, phaseTag, slug)

  // Wrap in Uint8Array via .buffer slice so the typing matches BodyInit.
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}.pdf"`,
      // Each request must hit the route so the password check runs. Internal PDF
      // render is cached via unstable_cache below.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  })
}

// === Auth helpers ============================================================

/** Decode the password portion of a Basic Authorization header. Returns null if absent or malformed. */
function parseBasicAuthPassword(header: string | null): string | null {
  if (!header) return null
  const [scheme, encoded] = header.split(" ", 2)
  if (scheme?.toLowerCase() !== "basic" || !encoded) return null
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8")
    const idx = decoded.indexOf(":")
    if (idx < 0) return decoded // No colon → treat whole string as password (lenient)
    return decoded.slice(idx + 1)
  } catch {
    return null
  }
}

/** Sanitize the competition name for inclusion in the WWW-Authenticate realm parameter. */
function escapeRealm(name: string): string {
  return name.replace(/[\\"]/g, "")
}

// === PDF buffer cache ========================================================
// Key: (competitionId, phaseTag). Tagged so server actions can revalidate per slug.
//
// IMPORTANT: unstable_cache serialises return values (JSON for the persistent cache),
// so a raw Buffer would deserialise as `{ type: "Buffer", data: [...] }` on cache hit
// and turn into an empty Uint8Array. We cache base64 instead and decode here.

async function renderPdfBuffer(
  competitionId: string,
  phaseTag: PhaseTag,
  slug: string
): Promise<Buffer> {
  const cached = unstable_cache(
    async () => {
      const buf = await buildAndRenderBuffer(competitionId, phaseTag)
      return buf.toString("base64")
    },
    ["public-pdf-buffer", competitionId, phaseTag],
    { revalidate: 86400, tags: [`public-pdf:${slug}`] }
  )
  const b64 = await cached()
  // Buffer is a Uint8Array subclass and is accepted as BodyInit by Next's Response.
  return Buffer.from(b64, "base64")
}

async function buildAndRenderBuffer(competitionId: string, phaseTag: PhaseTag): Promise<Buffer> {
  let element: ReactElement<DocumentProps>
  if (phaseTag === "ranking") element = await buildEventRankingElement(competitionId)
  else if (phaseTag === "standings") element = await buildSeasonStandingsElement(competitionId)
  else if (phaseTag === "schedule") element = await buildScheduleElement(competitionId)
  else element = await buildPlayoffsElement(competitionId)
  return renderToBuffer(element)
}

// === Builder functions — mirrors the protected PDF routes exactly =============

async function buildEventRankingElement(
  competitionId: string
): Promise<ReactElement<DocumentProps>> {
  const data = await getEventWithSeries(competitionId)
  if (!data) throw new Error("Competition not found while rendering public PDF")
  const { competition, series } = data

  const ranked = rankEventParticipants(series, {
    scoringMode: competition.scoringMode,
    targetValue: competition.targetValue,
    targetValueType: competition.targetValueType,
    competitionDisciplineId: competition.disciplineId,
    discipline: competition.discipline,
  })
  const isTeamEvent = (competition.teamSize ?? 0) >= 2
  const teamScoring = competition.teamScoring ?? "SUM"
  const teamRanked = isTeamEvent ? rankEventTeams(ranked, teamScoring, competition.scoringMode) : []

  return createElement(EventRankingPdf, {
    competitionName: competition.name,
    disciplineName: competition.discipline?.name ?? null,
    eventDate: competition.eventDate,
    scoringMode: competition.scoringMode,
    targetValueType: competition.targetValueType,
    shotsPerSeries: competition.shotsPerSeries,
    targetValue: competition.targetValue,
    isMixed: !competition.disciplineId,
    entries: ranked,
    teamEntries: isTeamEvent ? teamRanked : undefined,
    teamScoring: isTeamEvent ? teamScoring : undefined,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>
}

async function buildSeasonStandingsElement(
  competitionId: string
): Promise<ReactElement<DocumentProps>> {
  const data = await getSeasonWithSeries(competitionId)
  if (!data) throw new Error("Competition not found while rendering public PDF")
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

  return createElement(SeasonStandingsPdf, {
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
}

async function buildScheduleElement(competitionId: string): Promise<ReactElement<DocumentProps>> {
  const competition = await getCompetitionById(competitionId)
  if (!competition) throw new Error("Competition not found while rendering public PDF")

  const isBestOf = competition.leagueFormat === "BEST_OF_SINGLE"
  const scoringType = getEffectiveScoringType(competition.scoringMode, competition.discipline)
  const disciplineName = competition.discipline?.name ?? "Gemischt"

  const [standingsClassic, standingsBestOf, matchups] = await Promise.all([
    isBestOf ? Promise.resolve([]) : getStandingsForCompetition(competitionId),
    isBestOf ? getBestOfStandingsForCompetition(competitionId) : Promise.resolve([]),
    getMatchupsForCompetition(competitionId),
  ])

  if (isBestOf) {
    return createElement(BestOfSchedulePdf, {
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
  }

  return createElement(SchedulePdf, {
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

async function buildPlayoffsElement(competitionId: string): Promise<ReactElement<DocumentProps>> {
  const [competition, bracket] = await Promise.all([
    getCompetitionById(competitionId),
    getPlayoffBracket(competitionId),
  ])
  if (!competition) throw new Error("Competition not found while rendering public PDF")

  return createElement(PlayoffsPdf, {
    leagueName: competition.name,
    disciplineName: competition.discipline?.name ?? "Gemischt",
    scoringType: getEffectiveScoringType(competition.scoringMode, competition.discipline),
    bracket,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>
}
