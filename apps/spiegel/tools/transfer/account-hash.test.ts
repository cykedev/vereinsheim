import { afterAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "../../src/lib/db"
import { accountHash, emailHash } from "./account-hash"

const db = createPrismaClient()

afterAll(async () => {
  await db.$disconnect()
})

describe("emailHash und accountHash", () => {
  it("Groß- und Kleinschreibung und Rand ergeben denselben Wert", () => {
    expect(emailHash(" A@Example.com ")).toBe(emailHash("a@example.com"))
    expect(emailHash("a@example.com")).toMatch(/^[0-9a-f]{64}$/)
    expect(accountHash("A@example.com")).toBe(emailHash("a@example.com").slice(0, 8))
    expect(accountHash("a@example.com")).toHaveLength(8)
    expect(emailHash("b@example.com")).not.toBe(emailHash("a@example.com"))
  })

  it("ist derselbe Wert wie sha256 in Postgres über lower(btrim())", async () => {
    const [row] = await db.$queryRaw<{ hash: string }[]>`
      select encode(sha256(convert_to(lower(btrim(${" A@Example.com "})), 'UTF8')), 'hex') as hash`
    expect(row.hash).toBe(emailHash(" A@Example.com "))
  })
})
