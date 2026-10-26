import { formatMonthYear } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { db } from "@/lib/db"

import {
  disciplineRow,
  MIN_OWNERS_FOR_STATS,
  type DisciplineRow,
  type DisciplineStats,
  type FamilyRow,
} from "./discipline-model"

// Lesen für die Admin-Seite „Disziplinen“. Je Disziplin nur Zahlen über die ganze Anlage, nie Namen, Konten oder Schüsse
// ([[spiegel-privacy]]): Anzeige aus `Card.standScoring`, Schusszahl aus `CardProjection.printedShots`, die letzte
// Scheibe nur als Monat. Jede Funktion prüft selbst (`requireAdmin`), das Layout allein schützt die Daten nicht.

const STATUS_ORDER = { waiting: 0, suggested: 1, confirmed: 2, ignored: 3 } as const

/** die Anlage (eine je Installation, ADR-029; gibt es mehrere, die erste) */
const firstSite = () => db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })

const DISCIPLINE_SELECT = {
  id: true,
  meytonId: true,
  name: true,
  targetId: true,
  officialScoring: true,
  plannedShots: true,
  confirmedAt: true,
  ignoredAt: true,
  family: { select: { id: true, name: true } },
} as const

/** die Zeilen der Disziplinen einer Anlage mit ihren Zahlen; mit `id` nur diese eine */
async function rows(siteId: number, timeZone: string, id?: number): Promise<DisciplineRow[]> {
  const disciplines = await db.discipline.findMany({
    where: { siteId },
    select: DISCIPLINE_SELECT,
    orderBy: { name: "asc" },
  })
  const wanted = id === undefined ? disciplines : disciplines.filter((d) => d.id === id)
  if (!wanted.length) return []
  const ids = wanted.map((d) => d.id)
  const visible = { disciplineId: { in: ids }, deletedAt: null }
  const [counts, owners, stand, shots] = await Promise.all([
    db.card.groupBy({
      by: ["disciplineId"],
      where: visible,
      _count: true,
      _max: { startedAt: true },
    }),
    db.card.groupBy({
      by: ["disciplineId", "ownerId"],
      where: { ...visible, ownerId: { not: null } },
    }),
    db.card.groupBy({ by: ["disciplineId", "standScoring"], where: visible, _count: true }),
    db.$queryRaw<{ disciplineId: number; printedShots: number; n: number }[]>`
      SELECT c."disciplineId", p."printedShots", count(*)::int AS n
        FROM "Card" c JOIN "CardProjection" p ON p."cardId" = c.id
       WHERE c."deletedAt" IS NULL AND NOT p."probeOnly" AND c."disciplineId" = ANY(${ids})
       GROUP BY 1, 2`,
  ])

  const statsOf = (disciplineId: number): DisciplineStats => {
    const count = counts.find((c) => c.disciplineId === disciplineId)
    const scored = shots.filter((s) => s.disciplineId === disciplineId)
    const of = scored.reduce((sum, s) => sum + s.n, 0)
    const top = [...scored].sort((a, b) => b.n - a.n || b.printedShots - a.printedShots)[0]
    const standOf = (scoring: "decimal" | "rings") =>
      stand.find((s) => s.disciplineId === disciplineId && s.standScoring === scoring)?._count ?? 0
    const ownerCount = owners.filter((o) => o.disciplineId === disciplineId).length
    // mit weniger Schützen verlassen Anzeige am Stand und Schusszahl den Server nicht: Sie ließen sich einem Konto
    // zuordnen ([[spiegel-privacy]])
    const enough = ownerCount >= MIN_OWNERS_FOR_STATS
    return {
      cards: count?._count ?? 0,
      owners: ownerCount,
      lastCardMonth: count?._max.startedAt ? formatMonthYear(count._max.startedAt, timeZone) : null,
      stand: enough ? { decimal: standOf("decimal"), rings: standOf("rings") } : null,
      scoredCards: of,
      shots: enough && top ? { count: top.printedShots, cards: top.n, of } : null,
    }
  }

  // umbenannt: eine neue Disziplin, deren Werte die der zuletzt eingeordneten derselben Nummer sind
  const siblingOf = (d: (typeof disciplines)[number]): string | null => {
    if (d.confirmedAt) return null
    const sibling = disciplines
      .filter((o) => d.meytonId !== null && o.meytonId === d.meytonId && o.confirmedAt !== null)
      .sort((a, b) => b.confirmedAt!.getTime() - a.confirmedAt!.getTime())[0]
    if (!sibling) return null
    const same =
      sibling.targetId === d.targetId &&
      (sibling.family?.id ?? null) === (d.family?.id ?? null) &&
      sibling.officialScoring === d.officialScoring &&
      sibling.plannedShots === d.plannedShots &&
      (sibling.ignoredAt === null) === (d.ignoredAt === null)
    return same ? sibling.name : null
  }

  return wanted
    .map((discipline) =>
      disciplineRow({ discipline, stats: statsOf(discipline.id), sibling: siblingOf(discipline) })
    )
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.familyName ?? "\uffff").localeCompare(b.familyName ?? "\uffff", "de") ||
        b.stats.cards - a.stats.cards ||
        a.name.localeCompare(b.name, "de")
    )
}

/** alle Disziplinen der Anlage und die Familien mit der Zahl ihrer Disziplinen und Scheiben */
export async function disciplineOverview(
  timeZone: string
): Promise<{ rows: DisciplineRow[]; families: FamilyRow[] }> {
  await requireAdmin()
  const site = await firstSite()
  if (!site) return { rows: [], families: [] }
  const [list, families] = await Promise.all([rows(site.id, timeZone), familyRows(site.id)])
  return { rows: list, families }
}

/**
 * die Familien mit der Zahl ihrer Disziplinen an der Anlage und aller ihrer Scheiben, auch gelöschter: so wie
 * `removeFamily` prüft, ob sie leer ist
 */
async function familyRows(siteId: number): Promise<FamilyRow[]> {
  const families = await db.family.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: { select: { disciplines: { where: { siteId } }, cards: true } },
    },
  })
  return families.map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    disciplines: f._count.disciplines,
    cards: f._count.cards,
  }))
}

/** eine Disziplin der Anlage mit ihren Zahlen und die Familien zur Auswahl; null, wenn es sie nicht gibt */
export async function disciplineDetail(
  id: number,
  timeZone: string
): Promise<{ row: DisciplineRow; families: FamilyRow[] } | null> {
  await requireAdmin()
  if (!Number.isSafeInteger(id)) return null
  const site = await firstSite()
  if (!site) return null
  const [[row], families] = await Promise.all([rows(site.id, timeZone, id), familyRows(site.id)])
  if (!row) return null
  return { row, families }
}

/**
 * Für die Aufgabe in der Übersicht: nicht eingeordnete Disziplinen mit mindestens einer Scheibe, deren Scheiben warten
 * (ohne Scheibenbild oder Familie, nicht ignoriert) oder die einen Vorschlag haben
 */
export async function disciplineTaskCounts(): Promise<{ waiting: number; suggested: number }> {
  await requireAdmin()
  const site = await firstSite()
  if (!site) return { waiting: 0, suggested: 0 }
  const open = await db.discipline.findMany({
    where: { siteId: site.id, confirmedAt: null, cards: { some: { deletedAt: null } } },
    select: { targetId: true, familyId: true, ignoredAt: true },
  })
  const waiting = open.filter((d) => d.ignoredAt === null && (!d.targetId || d.familyId === null))
  return { waiting: waiting.length, suggested: open.length - waiting.length }
}
