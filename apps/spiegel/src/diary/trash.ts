// Papierkorb für Einträge wie für Scheiben ([[spiegel-privacy]]): Löschen setzt `deletedAt`, 30 Tage lässt sich der
// Eintrag wiederherstellen, danach löscht `purgeExpiredDiaryTrash` ihn endgültig. Im Papierkorb hält er keine Scheibe
// fest (`activeLinks`), seine Zeilen bleiben für das Wiederherstellen; die Scheiben selbst bleiben immer.

import type { Db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

import { entryCards } from "./cards"
import { eveningOf } from "./entries"
import { dayLabel } from "./summaries"
import { ERRORS } from "./texts"
import { dayOfDate } from "./validation"

export const DIARY_TRASH_DAYS = 30
const DAY_MS = 86_400_000

export const TRASH_ERRORS = {
  notInTrash: "Dieser Eintrag liegt nicht mehr im Papierkorb.",
  expired: "Die 30 Tage sind um. Der Eintrag lässt sich nicht mehr wiederherstellen.",
} as const

const endsAt = (deletedAt: Date) => deletedAt.getTime() + DIARY_TRASH_DAYS * DAY_MS

/** wie lange etwas noch im Papierkorb liegt („noch 29 Tage“) */
export function leftText(deletedAt: Date, nowMs: number): string {
  const days = Math.max(0, Math.ceil((endsAt(deletedAt) - nowMs) / DAY_MS))
  return days === 1 ? "noch 1 Tag" : days === 0 ? "wird gleich gelöscht" : `noch ${days} Tage`
}

/** in den Papierkorb */
export async function deleteEntry(db: Db, userId: string, entryId: string): Promise<string | null> {
  const { count } = await db.diaryEntry.updateMany({
    where: { id: entryId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return count === 1 ? null : ERRORS.missing
}

/**
 * Aus dem Papierkorb zurück, solange die 30 Tage nicht um sind. Seine Scheiben waren frei: Zurück kommen nur die, die
 * inzwischen in keinem anderen Eintrag stecken. Was ein anderer Eintrag des Abends von selbst trägt, bekommt dafür
 * eine feste Zeile, sonst nähme der zurückgekehrte Eintrag es ihm weg (zwei Einträge bieten nur noch an). Die Zeilen
 * des Eintrags, die keine andere Zuordnung ersetzt hat, gelten wieder.
 */
export async function restoreEntry(
  db: Db,
  userId: string,
  entryId: string,
  timeZone: string,
  nowMs = Date.now()
): Promise<string | null> {
  const row = await db.diaryEntry.findFirst({
    where: { id: entryId, userId },
    select: { deletedAt: true, day: true, familyId: true },
  })
  if (!row) return ERRORS.missing
  if (!row.deletedAt) return TRASH_ERRORS.notInTrash
  if (endsAt(row.deletedAt) <= nowMs) return TRASH_ERRORS.expired
  const deletedAt = row.deletedAt
  const evening =
    row.familyId === null
      ? null
      : await eveningOf(db, userId, dayOfDate(row.day), row.familyId, timeZone)
  const held = evening
    ? [
        ...entryCards(
          evening.entries,
          evening.links,
          evening.cards.map((c) => ({ id: c.id, day: c.day, familyId: c.family!.id }))
        ),
      ].flatMap(([id, set]) => (id === entryId ? [] : set.added.map((cardId) => ({ id, cardId }))))
    : []
  try {
    return await db.$transaction(
      async (tx) => {
        for (const { id, cardId } of held)
          await tx.diaryEntryCard.upsert({
            where: { cardId },
            create: { cardId, entryId: id, link: "linked" },
            update: { entryId: id, link: "linked" },
          })
        const { count } = await tx.diaryEntry.updateMany({
          where: { id: entryId, userId, deletedAt },
          data: { deletedAt: null },
        })
        return count === 1 ? null : ERRORS.missing
      },
      { isolationLevel: "Serializable" }
    )
  } catch {
    return ERRORS.failed
  }
}

/** sofort endgültig löschen, nur aus dem Papierkorb; Werte, Verknüpfungen und Ausführung gehen mit (Kaskade) */
export async function purgeEntryNow(
  db: Db,
  userId: string,
  entryId: string
): Promise<string | null> {
  const { count } = await db.diaryEntry.deleteMany({
    where: { id: entryId, userId, deletedAt: { not: null } },
  })
  return count === 1 ? null : TRASH_ERRORS.notInTrash
}

/** abgelaufene Einträge, Ziele und Abläufe aller Konten endgültig löschen (beim Start und stündlich); die Zahl */
export async function purgeExpiredDiaryTrash(
  db: Db,
  { nowMs }: { nowMs: number }
): Promise<number> {
  const where = { deletedAt: { lte: new Date(nowMs - DIARY_TRASH_DAYS * DAY_MS) } }
  const [entries, goals, routines] = await Promise.all([
    db.diaryEntry.deleteMany({ where }),
    db.diaryGoal.deleteMany({ where }),
    db.diaryRoutine.deleteMany({ where }),
  ])
  return entries.count + goals.count + routines.count
}

/** ein Ziel oder Ablauf im Papierkorb: Name und wie lange noch */
export interface DiaryTrashThing {
  id: string
  name: string
  left: string
}

/** die eigenen Ziele und Abläufe im Papierkorb, zuletzt gelöschte oben */
export async function diaryTrashThings(
  db: Db,
  userId: string,
  nowMs = Date.now()
): Promise<{ goals: DiaryTrashThing[]; routines: DiaryTrashThing[] }> {
  const where = { userId, deletedAt: { not: null } }
  const [goals, routines] = await Promise.all([
    db.diaryGoal.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      select: { id: true, title: true, deletedAt: true },
    }),
    db.diaryRoutine.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, deletedAt: true },
    }),
  ])
  return {
    goals: goals.map((g) => ({ id: g.id, name: g.title, left: leftText(g.deletedAt!, nowMs) })),
    routines: routines.map((r) => ({
      id: r.id,
      name: r.name,
      left: leftText(r.deletedAt!, nowMs),
    })),
  }
}

export interface DiaryTrashItem {
  entryId: string
  /** „Fr 13.03.“ */
  day: string
  /** „Luftpistole · 1 Scheibe“, „Mentaltraining“ */
  facts: string
  /** „noch 29 Tage“ */
  left: string
}

/** die eigenen Einträge im Papierkorb, zuletzt gelöschte oben */
export async function diaryTrash(
  db: Db,
  userId: string,
  timeZone: string,
  nowMs = Date.now()
): Promise<DiaryTrashItem[]> {
  const [rows, families] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        day: true,
        kind: true,
        familyId: true,
        deletedAt: true,
        _count: { select: { cards: { where: { link: "linked" } } } },
      },
    }),
    resultFamilies(db, userId),
  ])
  const nameOf = new Map(families.map((f) => [f.id, f.name]))
  return rows.map((row) => {
    const family = row.familyId === null ? null : (nameOf.get(row.familyId) ?? null)
    const cards = row._count.cards
    const facts =
      row.kind === "shooting"
        ? [family, cards === 1 ? "1 Scheibe" : cards ? `${cards} Scheiben` : null]
        : [row.kind === "dry" ? "Trockentraining" : "Mentaltraining", family]
    return {
      entryId: row.id,
      day: dayLabel(dayOfDate(row.day), timeZone),
      facts: facts.filter(Boolean).join(" · "),
      left: leftText(row.deletedAt!, nowMs),
    }
  })
}
