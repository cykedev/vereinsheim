import type { Discipline } from "@/generated/prisma/client"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import { db } from "@/lib/db"

function toSerializable(d: Discipline): SerializableDiscipline {
  return { ...d, teilerFaktor: d.teilerFaktor.toNumber() }
}

/** Alle aktiven (nicht archivierten) Disziplinen — für Auswahlfelder. */
export async function getDisciplines(): Promise<SerializableDiscipline[]> {
  const rows = await db.discipline.findMany({
    where: { isArchived: false },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  })
  return rows.map(toSerializable)
}

/** Alle Disziplinen inkl. archivierter — für Admin-Verwaltungsansicht. */
export async function getDisciplinesForManagement(): Promise<SerializableDiscipline[]> {
  const rows = await db.discipline.findMany({
    orderBy: [{ isSystem: "desc" }, { isArchived: "asc" }, { name: "asc" }],
  })
  return rows.map(toSerializable)
}

export async function getDisciplineById(id: string): Promise<SerializableDiscipline | null> {
  const row = await db.discipline.findUnique({ where: { id } })
  return row ? toSerializable(row) : null
}
