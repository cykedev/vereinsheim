// Disziplinen der Anlage anlegen: beim Einlesen und in `seed:own` auf demselben Weg. Eine Disziplin entsteht beim ersten
// Sehen mit einem Vorschlag; eingeordnet ist sie erst, wenn der Admin sie prüft (`confirmedAt`).

import { suggestIgnore, type FamilyId } from "@vereinsheim/shot-core/discipline"
import type { TargetId } from "@vereinsheim/shot-core/targets"

import type { Scoring } from "@/generated/prisma/client"

import type { Db } from "../db"
import { FAMILY_NAMES } from "../families"
import type { DisciplineGuess } from "../ingest/meyton-ssmdb2"

export interface KnownDiscipline {
  id: number
  targetId: TargetId | null
  version: number
  /**
   * die Zuordnung kam von einer eingeordneten Disziplin derselben Nummer (in Meyton umbenannt), nicht aus dem Vorschlag,
   * mit dem der Adapter gerechnet hat: die Scheibe braucht ein Nachrechnen
   */
  copied: boolean
}

/**
 * die Disziplin der Anlage; neu angelegt mit der Zuordnung einer eingeordneten Disziplin derselben Nummer (Meyton hat
 * sie umbenannt), sonst mit dem, was der Fachkern über sie weiß, und ignoriert, wenn ihre Wertung keinen Sinn ergibt
 * (`suggestIgnore`). Neu angelegt ist sie nie eingeordnet.
 */
export async function disciplineFor(
  db: Db,
  siteId: number,
  // `officialScoring` nur aus `seed:own` (die eigenen Scheiben); das Einlesen kennt die amtliche Wertung nie (SF-74)
  guess: DisciplineGuess & { officialScoring?: Scoring | null }
): Promise<KnownDiscipline> {
  const where = { siteId_meytonId_name: { siteId, meytonId: guess.meytonId, name: guess.name } }
  const select = { id: true, targetId: true, version: true } as const
  const existing = await db.discipline.findUnique({ where, select })
  if (existing) return { ...known(existing), copied: false }

  const sibling = await db.discipline.findFirst({
    where: { siteId, meytonId: guess.meytonId, confirmedAt: { not: null } },
    orderBy: { confirmedAt: "desc" },
    select: {
      targetId: true,
      familyId: true,
      officialScoring: true,
      plannedShots: true,
      ignoredAt: true,
    },
  })
  const mapping = sibling
    ? { ...sibling, ignoredAt: sibling.ignoredAt ? new Date() : null }
    : {
        targetId: guess.targetId,
        familyId: guess.family ? (await familyFor(db, guess.family)).id : null,
        // amtliche Wertung unbekannt, bis der Admin sie setzt (SF-74); nie aus der Anzeigeart
        officialScoring: guess.officialScoring ?? null,
        plannedShots: null,
        ignoredAt: suggestIgnore(guess.meytonId) ? new Date() : null,
      }
  const created = await db.discipline.upsert({
    where,
    create: { siteId, meytonId: guess.meytonId, name: guess.name, ...mapping },
    update: {},
    select,
  })
  return { ...known(created), copied: sibling !== null }
}

const known = (row: { id: number; targetId: string | null; version: number }) => ({
  id: row.id,
  targetId: row.targetId as TargetId | null,
  version: row.version,
})

/** eine Familie des Fachkerns, beim ersten Gebrauch angelegt */
function familyFor(db: Db, slug: FamilyId) {
  return db.family.upsert({
    where: { slug },
    create: { slug, name: FAMILY_NAMES[slug] },
    update: {},
    select: { id: true },
  })
}
