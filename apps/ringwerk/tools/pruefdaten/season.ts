// Saison-Szenarien: anlegen, einschreiben (gemischt mit Disziplin je Teilnehmer), Serien über die Saison verteilt
// eintragen, abschließen. Mindestserien 5: Je nach Phase erreichen manche sie, manche nicht, einer schießt gar nicht.

import { getEffectiveScoringType } from "@/lib/series/scoring-format"

import { act, addDays, dateField, formData, type Context } from "./context"
import { createRandom } from "./random"
import { ringsText, seriesValue, teilerText } from "./results"
import type { SeasonPhase, SeasonScenario } from "./scenarios"

const MIN_SERIES = 5
const SEASON_START = new Date("2026-01-01T00:00:00.000Z")
const SEASON_END = new Date("2026-09-30T00:00:00.000Z")

/** Serien je Teilnehmer nach Phase; die Zahl der Teilnehmer folgt aus der Länge. */
const SERIES_PER_PARTICIPANT: Record<SeasonPhase, number[]> = {
  leer: [],
  wenige: [2, 1, 2, 1, 0, 1, 2, 1],
  gemischt: [7, 6, 5, 5, 4, 2, 1, 0],
  fertig: [6, 5, 7, 5, 6, 5, 8, 5],
}

export async function buildSeason(ctx: Context, s: SeasonScenario): Promise<void> {
  const random = createRandom(s.code)
  const disciplineId = s.mixed ? "mixed" : ctx.disciplines["Luftgewehr"]
  const slug = s.public ? s.code.toLowerCase() : undefined

  const created = await act(ctx, "Saison anlegen", () =>
    ctx.rw.createCompetition(
      null,
      formData({
        name: s.name,
        type: "SEASON",
        scoringMode: s.scoringMode,
        shotsPerSeries: 10,
        disciplineId,
        minSeries: MIN_SERIES,
        seasonStart: dateField(SEASON_START),
        seasonEnd: dateField(SEASON_END),
        seasonSortMode: s.sortMode,
        isPublic: s.public !== undefined,
        publicSlug: slug,
        publicPassword: s.public?.startsWith("passwort") ? ctx.publicPassword : undefined,
        publicAccessFields: s.public ? "1" : undefined,
        publicQrBypass: s.public === "passwort-qr",
      })
    )
  )
  const id = created!.id
  const counts = SERIES_PER_PARTICIPANT[s.phase]
  if (counts.length === 0) return

  const players = random.shuffle(ctx.pool).slice(0, counts.length)
  const mixedDisciplines = [ctx.disciplines["Luftpistole"], ctx.disciplines["Luftgewehr"]]
  for (const [i, player] of players.entries()) {
    await act(ctx, "einschreiben", () =>
      ctx.rw.enrollParticipant(
        id,
        null,
        formData({
          participantId: player.id,
          disciplineId: s.mixed ? mixedDisciplines[i % 2] : undefined,
        })
      )
    )
  }

  const enrollments = await ctx.rw.db.competitionParticipant.findMany({
    where: { competitionId: id },
    orderBy: { createdAt: "asc" },
    select: {
      participantId: true,
      discipline: { select: { scoringType: true } },
    },
  })
  const fixed = s.mixed
    ? null
    : await ctx.rw.db.discipline.findUniqueOrThrow({
        where: { id: disciplineId },
        select: { scoringType: true },
      })
  const strengths = enrollments.map(() => random.next())
  const rounds = Math.max(...counts)
  // Abend für Abend: in Runde j schießen alle, die noch Serien offen haben.
  for (let j = 0; j < rounds; j++) {
    for (const [i, cp] of enrollments.entries()) {
      if (j >= counts[i]) continue
      const scoringType = getEffectiveScoringType(s.scoringMode, cp.discipline ?? fixed)
      const value = seriesValue(random, scoringType, strengths[i])
      await act(ctx, "Serie eintragen", () =>
        ctx.rw.saveSeasonSeries(
          id,
          cp.participantId,
          null,
          formData({
            rings: ringsText(value.rings, scoringType),
            teiler: teilerText(value.teiler),
            sessionDate: dateField(addDays(SEASON_START, 9 + j * 21 + i)),
          })
        )
      )
    }
  }

  if (s.phase === "fertig") {
    await act(ctx, "abschließen", () => ctx.rw.setCompetitionStatus(id, "COMPLETED"))
  }
}
