import type { PrismaClient, ScoringType } from "@/generated/prisma/client"

interface SystemDiscipline {
  name: string
  scoringType: ScoringType
  teilerFaktor: number
}

// Vorinstallierte Standarddisziplinen gemäss features.md
const SYSTEM_DISCIPLINES: SystemDiscipline[] = [
  { name: "Luftpistole", scoringType: "WHOLE", teilerFaktor: 0.3333333 },
  { name: "Luftgewehr", scoringType: "WHOLE", teilerFaktor: 1.0 },
  { name: "Luftpistole Auflage", scoringType: "DECIMAL", teilerFaktor: 0.6 },
  { name: "Luftgewehr Auflage", scoringType: "DECIMAL", teilerFaktor: 1.8 },
]

function buildSystemDisciplineId(name: string): string {
  // Deterministische IDs verhindern doppeltes Anlegen bei Wiederholung von runStartup()
  return `system-${name.toLowerCase().replace(/\s+/g, "-")}`
}

/**
 * Legt fehlende Systemdisziplinen an oder aktualisiert bestehende.
 * Idempotent — wird von runStartup() beim App-Start aufgerufen.
 */
export async function ensureSystemDisciplines(prisma: PrismaClient): Promise<number> {
  let changedCount = 0

  for (const discipline of SYSTEM_DISCIPLINES) {
    const id = buildSystemDisciplineId(discipline.name)

    const result = await prisma.discipline.upsert({
      where: { id },
      create: { id, ...discipline, isSystem: true },
      update: { teilerFaktor: discipline.teilerFaktor },
      select: { id: true },
    })

    if (result) changedCount++
  }

  return changedCount
}
