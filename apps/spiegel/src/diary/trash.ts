// Papierkorb für Einträge wie für Scheiben ([[spiegel-privacy]]): Löschen setzt `deletedAt`, 30 Tage lässt sich der
// Eintrag wiederherstellen, danach löscht `purgeExpiredDiaryTrash` ihn endgültig. Er behält seine Scheiben; die
// Scheiben selbst bleiben immer.

import type { Db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

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

/** in den Papierkorb */
export async function deleteEntry(db: Db, userId: string, entryId: string): Promise<string | null> {
  const { count } = await db.diaryEntry.updateMany({
    where: { id: entryId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return count === 1 ? null : ERRORS.missing
}

/** aus dem Papierkorb zurück, solange die 30 Tage nicht um sind */
export async function restoreEntry(
  db: Db,
  userId: string,
  entryId: string,
  nowMs = Date.now()
): Promise<string | null> {
  const row = await db.diaryEntry.findFirst({
    where: { id: entryId, userId },
    select: { deletedAt: true },
  })
  if (!row) return ERRORS.missing
  if (!row.deletedAt) return TRASH_ERRORS.notInTrash
  if (endsAt(row.deletedAt) <= nowMs) return TRASH_ERRORS.expired
  const { count } = await db.diaryEntry.updateMany({
    where: { id: entryId, userId, deletedAt: row.deletedAt },
    data: { deletedAt: null },
  })
  return count === 1 ? null : ERRORS.missing
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

/** abgelaufene Einträge aller Konten endgültig löschen (beim Start und stündlich); die Zahl */
export async function purgeExpiredDiaryTrash(
  db: Db,
  { nowMs }: { nowMs: number }
): Promise<number> {
  const { count } = await db.diaryEntry.deleteMany({
    where: { deletedAt: { lte: new Date(nowMs - DIARY_TRASH_DAYS * DAY_MS) } },
  })
  return count
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
    const days = Math.max(0, Math.ceil((endsAt(row.deletedAt!) - nowMs) / DAY_MS))
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
      left: days === 1 ? "noch 1 Tag" : days === 0 ? "wird gleich gelöscht" : `noch ${days} Tage`,
    }
  })
}
