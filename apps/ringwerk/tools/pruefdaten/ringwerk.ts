// Ringwerk im Werkzeug: Die Module der App werden erst geladen, nachdem `DATABASE_URL` auf die Prüfdatenbank zeigt
// (`@/lib/db` liest die URL beim Laden). Danach prüft eine Abfrage, dass die Verbindung wirklich dort ankommt.
//
// Der Prüfbestand schreibt über die Server-Actions der App, mit denselben Prüfungen, Folgezeilen und Protokolleinträgen
// wie die Oberfläche. `next-auth` und `next/cache` ersetzen die Stellvertreter unter `stubs/` (siehe `tsconfig.json`).

import { assertPruefDatabaseUrl } from "./db"

export async function loadRingwerk(url: string) {
  const name = assertPruefDatabaseUrl(url)
  // `@/lib/db` legt seinen Client beim ersten Laden an und merkt ihn sich global. Ist er schon da, hat ihn ein
  // früherer Import mit einer anderen URL angelegt.
  if ((globalThis as { prisma?: unknown }).prisma !== undefined) {
    throw new Error("@/lib/db wurde vor der Prüfdatenbank geladen, Abbruch")
  }
  process.env.DATABASE_URL = url

  const [
    { db },
    { runStartup },
    users,
    participants,
    disciplines,
    competitions,
    enrollments,
    matchups,
    results,
    bestOf,
    playoffs,
    series,
    standings,
  ] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/startup"),
    import("@/lib/users/actions"),
    import("@/lib/participants/actions"),
    import("@/lib/disciplines/actions"),
    import("@/lib/competitions/actions"),
    import("@/lib/competitionParticipants/actions"),
    import("@/lib/matchups/actions"),
    import("@/lib/results/actions"),
    import("@/lib/results/bestOfActions"),
    import("@/lib/playoffs/actions"),
    import("@/lib/series/actions"),
    import("@/lib/standings/queries"),
  ])

  const [{ current }] = await db.$queryRaw<
    { current: string }[]
  >`SELECT current_database() AS current`
  if (current !== name) {
    throw new Error(`Verbunden mit ${current} statt ${name}, Abbruch`)
  }

  return {
    db,
    runStartup,
    createUser: users.createUser,
    updateUser: users.updateUser,
    createParticipant: participants.createParticipant,
    setParticipantActive: participants.setParticipantActive,
    createDiscipline: disciplines.createDiscipline,
    setDisciplineArchived: disciplines.setDisciplineArchived,
    createCompetition: competitions.createCompetition,
    setCompetitionStatus: competitions.setCompetitionStatus,
    enrollParticipant: enrollments.enrollParticipant,
    withdrawParticipant: enrollments.withdrawParticipant,
    generateCompetitionSchedule: matchups.generateCompetitionSchedule,
    saveMatchResult: results.saveMatchResult,
    saveBestOfDuel: bestOf.saveBestOfDuel,
    saveStechschuss: bestOf.saveStechschuss,
    startPlayoffs: playoffs.startPlayoffs,
    addPlayoffDuel: playoffs.addPlayoffDuel,
    savePlayoffDuelResult: playoffs.savePlayoffDuelResult,
    advanceRound: playoffs.advanceRound,
    saveEventSeries: series.saveEventSeries,
    saveSeasonSeries: series.saveSeasonSeries,
    getStandingsForCompetition: standings.getStandingsForCompetition,
    getBestOfStandingsForCompetition: standings.getBestOfStandingsForCompetition,
  }
}

export type Ringwerk = Awaited<ReturnType<typeof loadRingwerk>>
