// Event-Szenarien: anlegen, Starterliste mit Startnummern (auch Gäste und Teams), Serien eintragen, abschließen und
// archivieren. Alles über Ringwerks Actions.

import type { ScoringType } from "@/generated/prisma/client"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"

import { act, dateField, formData, type Context } from "./context"
import { inventNames } from "./names"
import { createRandom, type Random } from "./random"
import { ringsText, seriesValue, teilerText, type SeriesValue } from "./results"
import type { EventScenario } from "./scenarios"

const round1 = (value: number) => Math.round(value * 10) / 10

export async function buildEvent(ctx: Context, s: EventScenario, start: Date): Promise<void> {
  const random = createRandom(s.code)
  const disciplineId = s.mixed ? "mixed" : ctx.disciplines[s.discipline ?? "Luftgewehr"]
  const slug = s.public ? s.code.toLowerCase() : undefined

  const created = await act(ctx, "Event anlegen", () =>
    ctx.rw.createCompetition(
      null,
      formData({
        name: s.name,
        type: "EVENT",
        scoringMode: s.scoringMode,
        shotsPerSeries: 10,
        disciplineId,
        eventDate: dateField(start),
        allowGuests: (s.guests ?? 0) > 0,
        teamSize: s.team?.size,
        teamScoring: s.team?.scoring,
        targetValue: s.target ? String(s.target.value).replace(".", ",") : undefined,
        targetValueType: s.target?.type,
        isPublic: s.public !== undefined,
        publicSlug: slug,
        publicPassword: s.public?.startsWith("passwort") ? ctx.publicPassword : undefined,
        publicAccessFields: s.public ? "1" : undefined,
        publicQrBypass: s.public === "passwort-qr",
      })
    )
  )
  const id = created!.id
  if (s.phase === "leer") return

  const players = [
    ...random.shuffle(ctx.pool).slice(0, s.size),
    ...(s.formerMembers ? ctx.formerPool : []),
  ]
  const mixedDisciplines = [ctx.disciplines["Luftpistole"], ctx.disciplines["Luftgewehr"]]
  let startNumber = 0
  for (const [i, player] of players.entries()) {
    startNumber++
    const team = s.team
    let teamFields: Record<string, string | boolean | undefined> = {}
    if (team) {
      if (i % team.size === 0) {
        teamFields = { newTeam: true }
      } else {
        const latest = await ctx.rw.db.eventTeam.findFirstOrThrow({
          where: { competitionId: id },
          orderBy: { teamNumber: "desc" },
          select: { id: true },
        })
        teamFields = { teamId: latest.id }
      }
    }
    await act(ctx, "einschreiben", () =>
      ctx.rw.enrollParticipant(
        id,
        null,
        formData({
          participantId: player.id,
          startNumber,
          disciplineId: s.mixed ? mixedDisciplines[i % 2] : undefined,
          ...teamFields,
        })
      )
    )
  }
  const guestNames = inventNames(createRandom(`${s.code}-gast`), s.guests ?? 0)
  for (const guest of guestNames) {
    startNumber++
    await act(ctx, "Gast einschreiben", () =>
      ctx.rw.enrollParticipant(
        id,
        null,
        formData({
          isGuest: true,
          guestName: `${guest.firstName} ${guest.lastName}`,
          startNumber,
        })
      )
    )
  }
  if (s.phase === "starterliste") return

  const enrollments = await ctx.rw.db.competitionParticipant.findMany({
    where: { competitionId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, discipline: { select: { scoringType: true } } },
  })
  const fixed = s.mixed
    ? null
    : await ctx.rw.db.discipline.findUniqueOrThrow({
        where: { id: disciplineId },
        select: { scoringType: true },
      })
  const scored =
    s.phase === "teilweise" ? enrollments.slice(0, Math.floor(enrollments.length / 2)) : enrollments
  const values: SeriesValue[] = []
  for (const [i, cp] of scored.entries()) {
    const scoringType = getEffectiveScoringType(
      s.scoringMode,
      cp.discipline ?? fixed,
      s.target?.type ?? null
    )
    let value = targetedValue(random, s, scoringType, i)
    // Geteilte Plätze: der zweite und vierte Eintrag schießen genau wie der Eintrag davor.
    if (s.sharedPlaces && (i === 1 || i === 3)) value = values[i - 1]
    values.push(value)
    await act(ctx, "Serie eintragen", () =>
      ctx.rw.saveEventSeries(
        id,
        cp.id,
        null,
        formData({ rings: ringsText(value.rings, scoringType), teiler: teilerText(value.teiler) })
      )
    )
  }

  if (s.phase === "teilweise") return
  await act(ctx, "abschließen", () => ctx.rw.setCompetitionStatus(id, "COMPLETED"))
  if (s.phase === "archiviert") {
    await act(ctx, "archivieren", () => ctx.rw.setCompetitionStatus(id, "ARCHIVED"))
  }
  if (s.archiveDiscipline) {
    await act(ctx, "Disziplin archivieren", () =>
      ctx.rw.setDisciplineArchived(ctx.disciplines[s.discipline!], true)
    )
  }
}

/** Serie um den Zielwert verteilt; der dritte Eintrag trifft ihn genau. Ohne Zielwert eine Serie nach Stärke. */
function targetedValue(
  random: Random,
  s: EventScenario,
  scoringType: ScoringType,
  index: number
): SeriesValue {
  const base = seriesValue(random, scoringType, random.next())
  if (!s.target) return base
  const exact = index === 2
  const { type, value } = s.target
  if (type === "TEILER") {
    return { ...base, teiler: exact ? value : Math.max(0.5, round1(value + random.normal(0, 25))) }
  }
  if (type === "RINGS") {
    return {
      ...base,
      rings: exact ? value : Math.min(100, Math.round(value + random.normal(0, 4))),
    }
  }
  return { ...base, rings: exact ? value : Math.min(109, round1(value + random.normal(0, 3))) }
}
