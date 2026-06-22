"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { SeriesSchema, resolveRingteiler, revalidateEventPaths } from "./_shared"

/**
 * Speichert eine Serie für einen Event-Teilnehmer.
 * Pro Einschreibung (CompetitionParticipant) ist genau eine Serie erlaubt — bestehende wird überschrieben.
 */
export async function saveEventSeries(
  competitionId: string,
  competitionParticipantId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      type: true,
      status: true,
      shotsPerSeries: true,
      disciplineId: true,
      scoringMode: true,
      targetValueType: true,
    },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.type !== "EVENT") return { error: "Nur für Event-Wettbewerbe." }
  if (competition.status === "ARCHIVED") return { error: "Archivierte Wettbewerbe sind gesperrt." }

  // Disziplin bestimmen: aus CompetitionParticipant (gemischt) oder Competition (fix)
  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      participantId: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true, teilerFaktor: true } },
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." }

  let disciplineId = cp.disciplineId
  let discipline = cp.discipline

  if (!disciplineId || !discipline) {
    // Feste Disziplin der Competition verwenden
    if (!competition.disciplineId) return { error: "Keine Disziplin konfiguriert." }
    const compDiscipline = await db.discipline.findUnique({
      where: { id: competition.disciplineId },
      select: { id: true, name: true, scoringType: true, teilerFaktor: true },
    })
    if (!compDiscipline) return { error: "Disziplin nicht gefunden." }
    disciplineId = compDiscipline.id
    discipline = compDiscipline
  }

  const parsed = SeriesSchema.safeParse({
    rings: formData.get("rings"),
    teiler: formData.get("teiler"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { rings, teiler } = parsed.data

  const scoring = resolveRingteiler(competition, discipline, rings, teiler)
  if ("error" in scoring) return { error: scoring.error }
  const { ringteiler } = scoring

  const sessionDate = new Date()

  // Bestehendes Ergebnis prüfen (eine Serie pro Einschreibung pro Event)
  const existing = await db.series.findUnique({
    where: { competitionParticipantId },
    select: { id: true },
  })

  if (existing) {
    await db.series.update({
      where: { id: existing.id },
      data: {
        rings,
        teiler,
        ringteiler,
        disciplineId,
        shotCount: competition.shotsPerSeries,
        sessionDate,
        recordedByUserId: session.user.id,
      },
    })
  } else {
    await db.series.create({
      data: {
        competitionId,
        participantId: cp.participantId,
        competitionParticipantId,
        disciplineId,
        rings,
        teiler,
        ringteiler,
        shotCount: competition.shotsPerSeries,
        sessionDate,
        recordedByUserId: session.user.id,
      },
    })
  }

  const participantName = `${cp.participant.firstName} ${cp.participant.lastName}`

  await db.auditLog.create({
    data: {
      eventType: existing ? "EVENT_SERIES_CORRECTED" : "EVENT_SERIES_ENTERED",
      entityType: "SERIES",
      entityId: existing?.id ?? competitionParticipantId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName,
        rings,
        teiler,
        disciplineName: discipline.name,
      },
    },
  })

  await revalidateEventPaths(competitionId)
  return { success: true }
}

/** Löscht die Serie eines Event-Teilnehmers. */
export async function deleteEventSeries(
  seriesId: string,
  competitionId: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const series = await db.series.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      competitionId: true,
      rings: true,
      teiler: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!series) return { error: "Serie nicht gefunden." }
  if (series.competitionId !== competitionId) return { error: "Ungültige Anfrage." }

  await db.series.delete({ where: { id: seriesId } })

  await db.auditLog.create({
    data: {
      eventType: "EVENT_SERIES_DELETED",
      entityType: "SERIES",
      entityId: seriesId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName: `${series.participant.firstName} ${series.participant.lastName}`,
        rings: series.rings,
        teiler: series.teiler,
      },
    },
  })

  await revalidateEventPaths(competitionId)
  return { success: true }
}
