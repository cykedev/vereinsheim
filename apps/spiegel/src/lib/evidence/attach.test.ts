import { createHash } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writeEnteredCard } from "../db/entered"
import { attachEvidenceIn } from "./attach"
import { EVIDENCE_LIMIT } from "./texts"

// Gegen die Dev-Datenbank, eigene Anlage: die Regeln, die `attachEvidence` und die Übernahme teilen.

const db = createPrismaClient()
let site: TestSite
let otherId: string

beforeAll(async () => {
  site = await createTestSite(db, "evidence-attach")
  otherId = (
    await db.user.create({
      data: { email: `evidence-attach-other-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
})

afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

async function card() {
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "manual",
    disciplineId: site.disciplineId,
    startedAtMs: Date.UTC(2026, 9, 2, 17),
    kind: "training",
    details: { total: { shots: 40, rings: 360 } },
    reason: "eingetragen",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

const row = (cardId: string, n: number, ownerId = site.ownerId) => ({
  cardId,
  ownerId,
  sha256: createHash("sha256").update(`${site.siteId}-${cardId}-${n}`).digest("hex"),
  type: "image/png" as const,
  size: 10,
  fileName: `foto-${n}.png`,
})
const attach = (data: ReturnType<typeof row>) => db.$transaction((tx) => attachEvidenceIn(tx, data))

describe("attachEvidenceIn", () => {
  it("hängt an, dieselbe Datei nur einmal, bis zur Grenze", async () => {
    const cardId = await card()
    expect(await attach(row(cardId, 0))).toBe("attached")
    expect(await attach(row(cardId, 0))).toBe("duplicate")
    for (let n = 1; n < EVIDENCE_LIMIT; n++) expect(await attach(row(cardId, n))).toBe("attached")
    expect(await attach(row(cardId, EVIDENCE_LIMIT))).toBe("limit")
    expect(await db.cardEvidence.count({ where: { cardId } })).toBe(EVIDENCE_LIMIT)
  })

  it("nicht an eine fremde oder gelöschte Scheibe", async () => {
    const cardId = await card()
    expect(await attach(row(cardId, 0, otherId))).toBe("gone")
    await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
    expect(await attach(row(cardId, 1))).toBe("gone")
    expect(await attach(row("c0000000000000000000000", 0))).toBe("gone")
  })
})
