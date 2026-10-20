import type { Discipline } from "@/generated/prisma/client"
import type { DisciplineFactorLock, SerializableDiscipline } from "@/lib/disciplines/types"
import { db } from "@/lib/db"

function toSerializable(d: Discipline): SerializableDiscipline {
  return { ...d, teilerFaktor: d.teilerFaktor.toNumber() }
}

/** Alle aktiven (nicht archivierten) Disziplinen — für Auswahlfelder. */
export async function getDisciplines(): Promise<SerializableDiscipline[]> {
  const rows = await db.discipline.findMany({
    where: { isArchived: false },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }, { id: "asc" }],
  })
  return rows.map(toSerializable)
}

/** Alle Disziplinen inkl. archivierter — für Admin-Verwaltungsansicht. */
export async function getDisciplinesForManagement(): Promise<SerializableDiscipline[]> {
  const rows = await db.discipline.findMany({
    orderBy: [{ isSystem: "desc" }, { isArchived: "asc" }, { name: "asc" }, { id: "asc" }],
  })
  return rows.map(toSerializable)
}

export async function getDisciplineById(id: string): Promise<SerializableDiscipline | null> {
  const row = await db.discipline.findUnique({ where: { id } })
  return row ? toSerializable(row) : null
}

/**
 * Warum der Faktor einer Disziplin nicht mehr änderbar ist: „system“ bei einer Standarddisziplin (Ringwerk legt ihn
 * fest), „used“, sobald ein Wettbewerb, eine Einschreibung oder eine Serie sie verwendet (gespeicherte Ringteiler
 * enthalten den Faktor), sonst null.
 */
export async function getDisciplineFactorLock(id: string): Promise<DisciplineFactorLock> {
  const discipline = await db.discipline.findUnique({ where: { id }, select: { isSystem: true } })
  if (discipline?.isSystem) return "system"
  const counts = await Promise.all([
    db.competition.count({ where: { disciplineId: id } }),
    db.competitionParticipant.count({ where: { disciplineId: id } }),
    db.series.count({ where: { disciplineId: id } }),
  ])
  return counts.some((n) => n > 0) ? "used" : null
}
