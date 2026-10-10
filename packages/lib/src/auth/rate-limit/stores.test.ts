import { describe, expect, it } from "vitest"

import {
  createDbStore,
  createInMemoryStore,
  createStoreForEnv,
  type LoginRateLimitBucketDelegate,
  type LoginRateLimitBucketRow,
} from "./stores"
import type { LoginRateLimitStore } from "./types"

/**
 * eine Tabelle `LoginRateLimitBucket` im Speicher, die die Schnittstelle erfüllt: genau die Abfragen, die der Store
 * schickt (wie Prisma sie auswerten würde)
 */
function fakeTable() {
  const rows = new Map<string, LoginRateLimitBucketRow>()
  const order = (a: LoginRateLimitBucketRow, b: LoginRateLimitBucketRow) =>
    a.lastAttemptAt.getTime() - b.lastAttemptAt.getTime() || (a.key < b.key ? -1 : 1)
  const table: LoginRateLimitBucketDelegate = {
    async findUnique({ where }) {
      return rows.get(where.key) ?? null
    },
    async findMany({ where, take }) {
      let found = [...rows.values()]
      if (where && "key" in where) found = found.filter((r) => where.key.in.includes(r.key))
      if (where && "blockedUntil" in where)
        found = found.filter((r) => r.blockedUntil && r.blockedUntil > where.blockedUntil.gt)
      if (where && "lastAttemptAt" in where)
        found = found.filter((r) => r.lastAttemptAt >= where.lastAttemptAt.gte)
      found.sort(order)
      return take === undefined ? found : found.slice(0, take)
    },
    async upsert({ where, create, update }) {
      const existing = rows.get(where.key)
      rows.set(where.key, existing ? { ...existing, ...update } : create)
      return null
    },
    async deleteMany({ where }) {
      for (const row of [...rows.values()]) {
        const hit =
          !("key" in where) && !("lastAttemptAt" in where)
            ? true
            : "key" in where
              ? typeof where.key === "string"
                ? row.key === where.key
                : where.key.in.includes(row.key)
              : row.lastAttemptAt < where.lastAttemptAt.lt &&
                (row.blockedUntil === null || row.blockedUntil < where.lastAttemptAt.lt)
        if (hit) rows.delete(row.key)
      }
      return null
    },
    async count() {
      return rows.size
    },
  }
  return { table, rows }
}

const bucket = (attempts: number, at: number, blockedUntil = 0) => ({
  attempts,
  windowStartedAt: at,
  blockedUntil,
  lastAttemptAt: at,
})

/** was jeder Store gleich können muss */
async function sharedBehaviour(store: LoginRateLimitStore) {
  await store.resetForTests()
  await store.set("email:a@example.com", bucket(2, 10))
  await store.set("email:b@example.com", bucket(1, 5, 50))
  await store.set("ip:198.51.100.1", bucket(3, 30))
  expect(await store.count()).toBe(3)
  expect(await store.get("email:a@example.com")).toEqual(bucket(2, 10))
  expect(await store.get("email:b@example.com")).toEqual(bucket(1, 5, 50))
  expect(await store.get("email:fehlt")).toBeNull()
  const many = await store.getMany(["email:a@example.com", "email:fehlt"])
  expect([...many.keys()]).toEqual(["email:a@example.com"])

  await store.set("email:a@example.com", bucket(4, 12))
  expect(await store.get("email:a@example.com")).toEqual(bucket(4, 12))

  // aufräumen bis 20: a (12) und b (letzter Versuch 5) sind alt, aber b ist bis 50 gesperrt und bleibt
  await store.deleteExpired(20)
  expect(await store.get("email:a@example.com")).toBeNull()
  expect(await store.get("email:b@example.com")).not.toBeNull()

  await store.deleteMany(["email:b@example.com"])
  await store.delete("ip:198.51.100.1")
  expect(await store.count()).toBe(0)
}

describe("createInMemoryStore", () => {
  it("speichert, liest, räumt auf und lässt aktive Sperren stehen", async () => {
    await sharedBehaviour(createInMemoryStore())
  })

  it("die ältesten nach letzter Relevanz (Sperre zählt)", async () => {
    const store = createInMemoryStore()
    await store.set("a", bucket(1, 10, 100))
    await store.set("b", bucket(1, 20))
    await store.set("c", bucket(1, 30))
    expect(await store.getOldestKeys(2)).toEqual(["b", "c"])
    expect(await store.getOldestKeys(0)).toEqual([])
  })
})

describe("createDbStore", () => {
  it("dasselbe Verhalten über die Tabelle", async () => {
    await sharedBehaviour(createDbStore(fakeTable().table))
  })

  it("rechnet Zeiten in Datum um, keine Sperre als null", async () => {
    const { table, rows } = fakeTable()
    const store = createDbStore(table)
    await store.set("email:a@example.com", bucket(1, 1_000))
    await store.set("email:b@example.com", bucket(5, 2_000, 9_000))
    expect(rows.get("email:a@example.com")).toEqual({
      key: "email:a@example.com",
      attempts: 1,
      windowStartedAt: new Date(1_000),
      blockedUntil: null,
      lastAttemptAt: new Date(1_000),
    })
    expect(rows.get("email:b@example.com")?.blockedUntil).toEqual(new Date(9_000))
    expect(await store.getOldestKeys(1)).toEqual(["email:a@example.com"])
    expect(await store.getMany([])).toEqual(new Map())
  })
})

describe("createStoreForEnv", () => {
  it("in Tests im Speicher, sonst über die Tabelle", async () => {
    const { table, rows } = fakeTable()
    await createStoreForEnv(table, "test").set("k", bucket(1, 1))
    expect(rows.size).toBe(0)
    await createStoreForEnv(table, "production").set("k", bucket(1, 1))
    expect(rows.size).toBe(1)
  })
})
