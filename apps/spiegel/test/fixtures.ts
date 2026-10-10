// Testdaten für die Zugriffe: je Testdatei eine eigene Anlage mit Quelle, Familie, Disziplin und Schütze, mit
// zufälligem Namen; `remove` löscht alles wieder (Kaskade über die Anlage).

import { randomUUID } from "node:crypto"

import type { Db } from "@/lib/db"

export interface TestSite {
  siteId: number
  sourceId: number
  familyId: number
  disciplineId: number
  ownerId: string
  remove: () => Promise<void>
}

export async function createTestSite(db: Db, label: string): Promise<TestSite> {
  const tag = `${label}-${randomUUID().slice(0, 8)}`
  const site = await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
  const source = await db.source.create({ data: { siteId: site.id, epoch: 1 } })
  const family = await db.family.create({ data: { name: `LP Freihand ${tag}` } })
  const discipline = await db.discipline.create({
    data: {
      siteId: site.id,
      meytonId: 10_199_005,
      name: "LP 40",
      familyId: family.id,
      targetId: "lp-10m",
      officialScoring: "rings",
    },
  })
  const owner = await db.user.create({ data: { email: `${tag}@example.com`, name: "Test" } })
  return {
    siteId: site.id,
    sourceId: source.id,
    familyId: family.id,
    disciplineId: discipline.id,
    ownerId: owner.id,
    remove: async () => {
      await db.site.delete({ where: { id: site.id } })
      await db.user.delete({ where: { id: owner.id } })
      await db.family.delete({ where: { id: family.id } })
    },
  }
}
