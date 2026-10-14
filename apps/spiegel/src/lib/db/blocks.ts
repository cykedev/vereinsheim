import type { Prisma } from "@/generated/prisma/client"

// Grabsteine und Löschsperren einer ScheibenID (SF-28, SF-77): Welcher Stand gehört zu welcher Scheibe, und ist sie
// gesperrt? Eine Stelle für Einlesen, Ablage und Entfernen (Review SP-1.7 a2: dieselbe Achse überall, der Beginn der
// Scheibe, nie die Beobachtung, denn die Brücke liest auch Wochen später nach).

type Tx = Prisma.TransactionClient

/**
 * So weit um den Beginn einer Scheibe gelten Grabsteine und Löschsperren derselben ScheibenID: Der Zähler kehrt erst
 * nach etwa 49,7 Tagen wieder (SF-77).
 */
export const CYCLE_WINDOW_MS = 30 * 86_400_000

/** dieselbe Scheibe, wenn ihr Beginn so nah liegt (wie `SAME_CARD_MS` im Einlesen) */
export const SAME_CARD_MS = 7 * 86_400_000

const DAY_MS = 86_400_000

/**
 * Beginn eines Stands, grob: der früheste plausible Schuss als Ortszeit (± die Zone), nur Zeiten bis einen Tag vor dem
 * letzten (eine Uhr, die 2009 zeigte, verschöbe sonst alles, SF-30); ohne Schuss die Beobachtung. Wie `startHint` in der
 * Brücke.
 */
export function startHintMs(
  zeitstempel: readonly (string | null | undefined)[],
  observedAtMs: number
): number {
  const times = zeitstempel
    .map((value) => Date.parse(`${(value ?? "").replace(" ", "T")}Z`))
    .filter((t) => Number.isFinite(t) && t > Date.UTC(1971, 0, 1))
  if (!times.length) return observedAtMs
  const last = Math.max(...times)
  return Math.min(...times.filter((t) => last - t <= DAY_MS))
}

/** Grabstein oder Löschsperre derselben Quelle und ScheibenID mit einem Beginn nahe `atMs` */
export async function isKeyBlocked(
  tx: Tx,
  key: { sourceId: number; scheibenId: number },
  atMs: number
): Promise<boolean> {
  const where = {
    ...key,
    startedAt: { gte: new Date(atMs - CYCLE_WINDOW_MS), lte: new Date(atMs + CYCLE_WINDOW_MS) },
  }
  const [tombstones, locks] = await Promise.all([
    tx.tombstone.count({ where }),
    tx.deleteLock.count({ where }),
  ])
  return tombstones + locks > 0
}

/**
 * Der höchste Zyklus, den diese Quelle und ScheibenID schon trug: an Scheiben, Grabsteinen und Löschsperren. Ein neuer
 * Zyklus liegt darüber, sonst bekäme eine neue Scheibe den Zyklus einer entfernten und ihr Grabstein passte nicht mehr
 * (Review SP-1.7 a2). Null, wenn es noch keinen gab.
 */
export async function maxCycleOfKey(
  tx: Tx,
  key: { sourceId: number; scheibenId: number }
): Promise<number | null> {
  const [card, tombstone, lock] = await Promise.all([
    tx.card.aggregate({ where: key, _max: { cycle: true } }),
    tx.tombstone.aggregate({ where: key, _max: { cycle: true } }),
    tx.deleteLock.aggregate({ where: key, _max: { cycle: true } }),
  ])
  const cycles = [card._max.cycle, tombstone._max.cycle, lock._max.cycle].filter(
    (c): c is number => c !== null
  )
  return cycles.length ? Math.max(...cycles) : null
}
