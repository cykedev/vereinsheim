import type { PrismaClient } from "@/generated/prisma/client"
import type { SessionForPeriod } from "@/lib/statistics/periodItems"

/** höchstens so viele Einheiten liest die Statistik, die neuesten zuerst ([[treffsicher-dos-protection]]) */
export const MAX_STATISTICS_SESSIONS = 1200

const DIMENSIONS = {
  fitness: true,
  nutrition: true,
  technique: true,
  tactics: true,
  mentalStrength: true,
  environment: true,
  equipment: true,
} as const

export type SelfImageKey = keyof typeof DIMENSIONS
export type SelfImageValues = Record<SelfImageKey, number>

/** eine Einheit, wie die Statistik sie liest: Eintrag der Seite, dazu Befinden, Ausführung, Prognose und Feedback */
export interface StatisticsSession extends SessionForPeriod {
  discipline: (NonNullable<SessionForPeriod["discipline"]> & { id: string; name: string }) | null
  series: (SessionForPeriod["series"][number] & { executionQuality: number | null })[]
  wellbeing: { sleep: number; energy: number; stress: number; motivation: number } | null
  prognosis: SelfImageValues | null
  feedback: SelfImageValues | null
}

/**
 * Die Einheiten eines Kontos für die Statistik: Training und Wettkampf, die neuesten `MAX_STATISTICS_SESSIONS`, in
 * zeitlicher Folge. Ergebnisse als Zahl (die Datenbank speichert Zehntel als Decimal).
 */
export async function statisticsSessions(
  db: Pick<PrismaClient, "trainingSession">,
  userId: string
): Promise<StatisticsSession[]> {
  const rows = await db.trainingSession.findMany({
    where: { userId, type: { in: ["TRAINING", "WETTKAMPF"] } },
    select: {
      id: true,
      date: true,
      type: true,
      hitLocationHorizontalMm: true,
      hitLocationHorizontalDirection: true,
      hitLocationVerticalMm: true,
      hitLocationVerticalDirection: true,
      discipline: {
        select: { id: true, name: true, shotsPerSeries: true, scoringType: true },
      },
      series: {
        select: {
          position: true,
          isPractice: true,
          scoreTotal: true,
          shots: true,
          executionQuality: true,
        },
        orderBy: { position: "asc" },
      },
      wellbeing: { select: { sleep: true, energy: true, stress: true, motivation: true } },
      prognosis: { select: DIMENSIONS },
      feedback: { select: DIMENSIONS },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: MAX_STATISTICS_SESSIONS,
  })
  return rows.reverse().map((row) => ({
    ...row,
    series: row.series.map((serie) => ({
      ...serie,
      scoreTotal: serie.scoreTotal === null ? null : Number(serie.scoreTotal),
    })),
  }))
}
