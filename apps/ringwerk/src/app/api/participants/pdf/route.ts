import { NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import { getParticipants } from "@/lib/participants/queries"
import { ParticipantListPdf } from "@/lib/pdf/ParticipantListPdf"

export async function GET(): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }
  if (!canManage(session.user.role)) {
    return new NextResponse("Keine Berechtigung", { status: 403 })
  }

  const participants = await getParticipants()

  const element = createElement(ParticipantListPdf, {
    participants,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="teilnehmerliste.pdf"',
      "Cache-Control": "no-store",
    },
  })
}
