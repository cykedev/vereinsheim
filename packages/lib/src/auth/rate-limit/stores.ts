// Stores der Ratenbegrenzung (vorher je App kopiert): im Speicher für Tests, in der Datenbank für Betrieb und
// Entwicklung. Die Tabelle kommt als Schnittstelle (`LoginRateLimitBucketDelegate`), die `db.loginRateLimitBucket` aus
// dem Prisma-Client jeder App erfüllt; die Bibliothek kennt kein Prisma.

import type { LoginBucket, LoginRateLimitStore } from "./types"

/** eine Zeile der Tabelle `LoginRateLimitBucket` */
export interface LoginRateLimitBucketRow {
  key: string
  attempts: number
  windowStartedAt: Date
  blockedUntil: Date | null
  lastAttemptAt: Date
}

/** die Spalten, die Store und Admin-Auswertung lesen */
export const LOGIN_BUCKET_SELECT = {
  key: true,
  attempts: true,
  windowStartedAt: true,
  blockedUntil: true,
  lastAttemptAt: true,
} as const

type Select = typeof LOGIN_BUCKET_SELECT
type Order = "asc" | "desc"

/** was Store und Admin-Auswertung von der Tabelle brauchen; der Prisma-Delegate passt darauf */
export interface LoginRateLimitBucketDelegate {
  findUnique(args: {
    where: { key: string }
    select: Select
  }): PromiseLike<LoginRateLimitBucketRow | null>
  findMany(args: {
    where?:
      | { key: { in: string[] } }
      | { blockedUntil: { gt: Date } }
      | { lastAttemptAt: { gte: Date } }
    select: Select
    orderBy?: { key?: Order; attempts?: Order; blockedUntil?: Order; lastAttemptAt?: Order }[]
    take?: number
  }): PromiseLike<LoginRateLimitBucketRow[]>
  upsert(args: {
    where: { key: string }
    create: LoginRateLimitBucketRow
    update: Omit<LoginRateLimitBucketRow, "key">
  }): PromiseLike<unknown>
  deleteMany(args: {
    where:
      | Record<string, never>
      | { key: string }
      | { key: { in: string[] } }
      | {
          lastAttemptAt: { lt: Date }
          OR: ({ blockedUntil: null } | { blockedUntil: { lt: Date } })[]
        }
  }): PromiseLike<unknown>
  count(args?: { where?: { blockedUntil: { gt: Date } } }): PromiseLike<number>
}

/** die Referenz eines Eintrags fürs Aufräumen: die letzte Relevanz, nicht die Erstellung */
const referenceOf = (bucket: LoginBucket) => Math.max(bucket.blockedUntil, bucket.lastAttemptAt)

/** im Speicher: Tests bleiben schnell und ohne Datenbank */
export function createInMemoryStore(): LoginRateLimitStore {
  const buckets = new Map<string, LoginBucket>()
  return {
    async get(key) {
      return buckets.get(key) ?? null
    },
    async set(key, bucket) {
      buckets.set(key, bucket)
    },
    async getMany(keys) {
      const result = new Map<string, LoginBucket>()
      for (const key of keys) {
        const bucket = buckets.get(key)
        if (bucket) result.set(key, bucket)
      }
      return result
    },
    async delete(key) {
      buckets.delete(key)
    },
    async deleteMany(keys) {
      for (const key of keys) buckets.delete(key)
    },
    async count() {
      return buckets.size
    },
    async getOldestKeys(limit) {
      if (limit <= 0) return []
      return [...buckets.entries()]
        .sort((a, b) => referenceOf(a[1]) - referenceOf(b[1]))
        .slice(0, limit)
        .map(([key]) => key)
    },
    async deleteExpired(cutoffMs) {
      for (const [key, bucket] of buckets.entries())
        if (referenceOf(bucket) < cutoffMs) buckets.delete(key)
    },
    async resetForTests() {
      buckets.clear()
    },
  }
}

const toBucket = (row: LoginRateLimitBucketRow): LoginBucket => ({
  attempts: row.attempts,
  windowStartedAt: row.windowStartedAt.getTime(),
  blockedUntil: row.blockedUntil ? row.blockedUntil.getTime() : 0,
  lastAttemptAt: row.lastAttemptAt.getTime(),
})

const toColumns = (bucket: LoginBucket) => ({
  attempts: bucket.attempts,
  windowStartedAt: new Date(bucket.windowStartedAt),
  blockedUntil: bucket.blockedUntil > 0 ? new Date(bucket.blockedUntil) : null,
  lastAttemptAt: new Date(bucket.lastAttemptAt),
})

/** in der Datenbank: mehrere Anfragen und Instanzen sehen dieselben Sperren */
export function createDbStore(table: LoginRateLimitBucketDelegate): LoginRateLimitStore {
  return {
    async get(key) {
      const row = await table.findUnique({ where: { key }, select: LOGIN_BUCKET_SELECT })
      return row ? toBucket(row) : null
    },
    async set(key, bucket) {
      const columns = toColumns(bucket)
      await table.upsert({ where: { key }, create: { key, ...columns }, update: columns })
    },
    async getMany(keys) {
      if (keys.length === 0) return new Map()
      const rows = await table.findMany({
        where: { key: { in: keys } },
        select: LOGIN_BUCKET_SELECT,
      })
      return new Map(rows.map((row) => [row.key, toBucket(row)]))
    },
    async delete(key) {
      await table.deleteMany({ where: { key } })
    },
    async deleteMany(keys) {
      if (keys.length === 0) return
      await table.deleteMany({ where: { key: { in: keys } } })
    },
    async count() {
      return table.count()
    },
    async getOldestKeys(limit) {
      if (limit <= 0) return []
      const rows = await table.findMany({
        select: LOGIN_BUCKET_SELECT,
        orderBy: [{ lastAttemptAt: "asc" }, { key: "asc" }],
        take: limit,
      })
      return rows.map((row) => row.key)
    },
    async deleteExpired(cutoffMs) {
      const cutoff = new Date(cutoffMs)
      // aktive Sperren bleiben, auch wenn der letzte Versuch länger zurückliegt
      await table.deleteMany({
        where: {
          lastAttemptAt: { lt: cutoff },
          OR: [{ blockedUntil: null }, { blockedUntil: { lt: cutoff } }],
        },
      })
    },
    async resetForTests() {
      await table.deleteMany({ where: {} })
    },
  }
}

/** der Store für die Umgebung: in Tests im Speicher, sonst in der Datenbank */
export function createStoreForEnv(
  table: LoginRateLimitBucketDelegate,
  nodeEnv: string | undefined
): LoginRateLimitStore {
  return nodeEnv === "test" ? createInMemoryStore() : createDbStore(table)
}
