import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { calculateRingteiler } from "@/lib/results/calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { getEffectiveScoringType, getMaxRings } from "@/lib/series/scoring-format"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"
import type { ScoringMode, ScoringType, TargetValueType } from "@/generated/prisma/client"

export const SeriesSchema = z.object({
  rings: z
    .string()
    .min(1, "Ringe sind erforderlich")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .pipe(z.number().min(0, "Ringe müssen ≥ 0 sein")),
  teiler: z
    .string()
    .min(1, "Teiler ist erforderlich")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .pipe(z.number().min(0, "Teiler muss ≥ 0 sein").max(9999.9, "Teiler zu groß")),
})

export const SeasonSeriesSchema = SeriesSchema.extend({
  sessionDate: z
    .string()
    .min(1, "Datum ist erforderlich")
    .transform((v) => new Date(v))
    .pipe(z.date({ message: "Ungültiges Datum" })),
  disciplineId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v || null),
})

export async function revalidateEventPaths(competitionId: string): Promise<void> {
  revalidatePath(`/competitions/${competitionId}/series`)
  revalidatePath(`/competitions/${competitionId}/ranking`)
  await revalidatePublicSlugForCompetition(competitionId)
}

export async function revalidateSeasonPaths(competitionId: string): Promise<void> {
  revalidatePath(`/competitions/${competitionId}/series`)
  revalidatePath(`/competitions/${competitionId}/standings`)
  await revalidatePublicSlugForCompetition(competitionId)
}

/** Minimaler Wettbewerbs-Kontext für die Ringteiler-Berechnung. */
interface ScoringCompetition {
  disciplineId: string | null
  shotsPerSeries: number
  scoringMode: ScoringMode
  targetValueType: TargetValueType | null
}

/** Minimaler Disziplin-Kontext für die Ringteiler-Berechnung. */
interface ScoringDiscipline {
  scoringType: ScoringType
  teilerFaktor: { toNumber(): number }
}

/**
 * Validiert die Ringe gegen das effektive Scoring-Format und berechnet den
 * Ringteiler. Liefert entweder ein strukturiertes Feld-Fehlerobjekt oder den
 * berechneten Ringteiler — Verhalten identisch zu den vorherigen Inline-Blöcken.
 */
export function resolveRingteiler(
  competition: ScoringCompetition,
  discipline: ScoringDiscipline,
  rings: number,
  teiler: number
): { error: Record<string, string[]> } | { ringteiler: number } {
  const effectiveScoringType = getEffectiveScoringType(
    competition.scoringMode,
    discipline,
    competition.targetValueType
  )
  const maxRings = getMaxRings(effectiveScoringType, competition.shotsPerSeries)
  if (rings > maxRings) {
    return {
      error: {
        rings: [
          `Maximal ${effectiveScoringType === "DECIMAL" ? maxRings.toFixed(1).replace(".", ",") : maxRings} Ringe erlaubt`,
        ],
      },
    }
  }
  if (effectiveScoringType === "WHOLE" && !Number.isInteger(rings)) {
    return { error: { rings: ["Nur ganze Ringe erlaubt"] } }
  }

  const teilerFaktor = effectiveTeilerFaktor(
    competition.disciplineId,
    discipline.teilerFaktor.toNumber()
  )
  return { ringteiler: calculateRingteiler(rings, teiler, teilerFaktor, maxRings) }
}

/** Disziplin-Auswahl mit Ringteiler-relevanten Feldern (Saison-Serien). */
type SeasonDiscipline = {
  id: string
  name: string
  scoringType: ScoringType
  teilerFaktor: { toNumber(): number }
}

/**
 * Ermittelt die effektive Disziplin für eine Saison-Serie:
 * formData (gemischt) → Teilnehmer-Disziplin → Competition-Disziplin.
 * Lädt bei abweichender Auswahl die Disziplin nach. Verhalten identisch zu den
 * vorherigen Inline-Blöcken in save-/updateSeasonSeries.
 */
export async function resolveSeasonDiscipline(
  formDisciplineId: string | null,
  cp: { disciplineId: string | null; discipline: SeasonDiscipline | null },
  competitionDisciplineId: string | null
): Promise<{ error: string } | { resolvedDisciplineId: string; discipline: SeasonDiscipline }> {
  const resolvedDisciplineId = formDisciplineId ?? cp.disciplineId ?? competitionDisciplineId

  let discipline = cp.discipline
  if (!discipline || (formDisciplineId && formDisciplineId !== cp.disciplineId)) {
    if (!resolvedDisciplineId) return { error: "Keine Disziplin konfiguriert." }
    const found = await db.discipline.findUnique({
      where: { id: resolvedDisciplineId },
      select: { id: true, name: true, scoringType: true, teilerFaktor: true },
    })
    if (!found) return { error: "Disziplin nicht gefunden." }
    discipline = found
  }

  if (!resolvedDisciplineId || !discipline) return { error: "Keine Disziplin konfiguriert." }

  return { resolvedDisciplineId, discipline }
}
