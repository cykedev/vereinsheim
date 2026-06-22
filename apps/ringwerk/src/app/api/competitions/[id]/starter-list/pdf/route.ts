import { NextResponse } from "next/server"
import { randomInt } from "node:crypto"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getCompetitionById } from "@/lib/competitions/queries"
import { getCompetitionParticipants } from "@/lib/competitionParticipants/queries"
import { buildStarterListRows } from "@/lib/pdf/eventStarterList"
import { EventStarterListPdf } from "@/lib/pdf/EventStarterListPdf"

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }
  if (!canManage(session.user.role)) {
    return new NextResponse("Keine Berechtigung", { status: 403 })
  }

  const { id } = await context.params
  const competition = await getCompetitionById(id)
  if (!competition) {
    return new NextResponse("Wettbewerb nicht gefunden", { status: 404 })
  }
  if (competition.type !== "EVENT") {
    return new NextResponse("Starterliste nur für Events verfügbar", { status: 400 })
  }

  const participants = await getCompetitionParticipants(id)

  const rows = buildStarterListRows({
    participants: participants.map((cp) => ({
      status: cp.status,
      participant: {
        firstName: cp.participant.firstName,
        lastName: cp.participant.lastName,
      },
      discipline: cp.discipline ? { name: cp.discipline.name } : null,
    })),
    competitionDisciplineName: competition.discipline?.name ?? null,
    // crypto.randomInt(n) returns 0..n-1; divide by n for Math.random()-compatible [0,1)
    random: () => randomInt(0, 1_000_000) / 1_000_000,
  })

  const element = createElement(EventStarterListPdf, {
    competitionName: competition.name,
    eventDate: competition.eventDate ?? null,
    participants: rows,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="starterliste-${slugify(competition.name)}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
