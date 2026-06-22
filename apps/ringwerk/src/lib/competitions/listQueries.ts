import { db } from "@/lib/db"
import type { CompetitionDetail, CompetitionListItem } from "@/lib/competitions/types"
import { disciplineSelect, listSelect } from "./querySelects"

/** Alle aktiven Wettbewerbe mit Disziplin und Teilnehmeranzahl — für allgemeine Ansicht. */
export async function getCompetitions(): Promise<CompetitionListItem[]> {
  const rows = await db.competition.findMany({
    where: { status: "ACTIVE" },
    select: listSelect,
    orderBy: { name: "asc" },
  })
  return rows.map(({ publicPasswordHash, ...row }) => ({
    ...row,
    hasPublicPassword: publicPasswordHash != null,
  }))
}

/** Alle Wettbewerbe (alle Status) — für Admin-Verwaltungsansicht. */
export async function getCompetitionsForManagement(): Promise<CompetitionListItem[]> {
  const rows = await db.competition.findMany({
    select: listSelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  })
  return rows.map(({ publicPasswordHash, ...row }) => ({
    ...row,
    hasPublicPassword: publicPasswordHash != null,
  }))
}

/** Einzelner Wettbewerb mit allen Feldern — für Edit-Seite und Detail-Pages. */
export async function getCompetitionById(id: string): Promise<CompetitionDetail | null> {
  const row = await db.competition.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      isPublic: true,
      publicSlug: true,
      publicPasswordHash: true,
      scoringMode: true,
      shotsPerSeries: true,
      disciplineId: true,
      discipline: { select: disciplineSelect },
      playoffBestOf: true,
      playoffHasViertelfinale: true,
      playoffHasAchtelfinale: true,
      finalePrimary: true,
      finaleTiebreaker1: true,
      finaleTiebreaker2: true,
      finaleHasSuddenDeath: true,
      leagueFormat: true,
      groupBestOf: true,
      groupPlayAllDuels: true,
      groupTiebreaker1: true,
      groupTiebreaker2: true,
      groupHasSuddenDeath: true,
      hinrundeDeadline: true,
      rueckrundeDeadline: true,
      eventDate: true,
      allowGuests: true,
      teamSize: true,
      teamScoring: true,
      targetValue: true,
      targetValueType: true,
      minSeries: true,
      seasonStart: true,
      seasonEnd: true,
      createdAt: true,
      _count: { select: { matchups: true } },
    },
  })
  if (!row) return null
  const { publicPasswordHash, ...rest } = row
  return {
    ...rest,
    hasPublicPassword: publicPasswordHash != null,
    discipline: row.discipline
      ? { ...row.discipline, teilerFaktor: row.discipline.teilerFaktor.toNumber() }
      : null,
    targetValue: row.targetValue ? row.targetValue.toNumber() : null,
  }
}
