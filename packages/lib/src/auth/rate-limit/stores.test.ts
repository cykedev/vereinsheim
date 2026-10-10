import { describe, expect, it } from "vitest"

import { bucketTable } from "./__fixtures__/table"
import { createDbStore, createInMemoryStore, createStoreForEnv } from "./stores"
import type { LoginRateLimitStore } from "./types"

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
  // seit 15 nicht mehr gesperrt: geht beim Aufräumen bis 20 mit
  await store.set("email:c@example.com", bucket(5, 4, 15))
  expect(await store.count()).toBe(4)
  expect(await store.get("email:a@example.com")).toEqual(bucket(2, 10))
  expect(await store.get("email:b@example.com")).toEqual(bucket(1, 5, 50))
  expect(await store.get("email:fehlt")).toBeNull()
  const many = await store.getMany(["email:a@example.com", "email:fehlt"])
  expect([...many.keys()]).toEqual(["email:a@example.com"])

  await store.set("email:a@example.com", bucket(4, 12))
  expect(await store.get("email:a@example.com")).toEqual(bucket(4, 12))

  // aufräumen bis 20: a (12), b (5) und c (4) sind alt; b ist bis 50 gesperrt und bleibt, c nur bis 15
  await store.deleteExpired(20)
  expect(await store.get("email:a@example.com")).toBeNull()
  expect(await store.get("email:b@example.com")).not.toBeNull()
  expect(await store.get("email:c@example.com")).toBeNull()

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
    await sharedBehaviour(createDbStore(bucketTable().table))
  })

  it("rechnet Zeiten in Datum um, keine Sperre als null", async () => {
    const { table, rows } = bucketTable()
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

  it("die ältesten nach dem letzten Versuch, nicht in der Folge des Schreibens", async () => {
    const store = createDbStore(bucketTable().table)
    await store.set("c", bucket(1, 30))
    await store.set("a", bucket(1, 20))
    await store.set("b", bucket(1, 10))
    expect(await store.getOldestKeys(2)).toEqual(["b", "a"])
    expect(await store.getOldestKeys(0)).toEqual([])
  })
})

describe("createStoreForEnv", () => {
  it("in Tests im Speicher, sonst über die Tabelle", async () => {
    const { table, rows } = bucketTable()
    await createStoreForEnv(table, "test").set("k", bucket(1, 1))
    expect(rows.size).toBe(0)
    await createStoreForEnv(table, "production").set("k", bucket(1, 1))
    expect(rows.size).toBe(1)
  })
})
