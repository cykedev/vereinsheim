// Zählung an der Dev-Datenbank, nur lesend: je Konto und Familie, was der Fortschritt über „Alles“ zählt, mit Einschießen
// (wie vor der Regel) und ohne (die Vorgabe, mit „nicht gezählt“), dazu das Einschießen aus SQL, unabhängig vom Code
// der Regel. Konten nur als Nummer in der Folge ihrer Kennung, nie Name, E-Mail
// oder Kennung. Die Ausgabe enthält Leistungsdaten: nur nach `reports/` (gitignored).
// Aufruf: pnpm --filter spiegel warmup-census > reports/<datei>.txt

import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { DEFAULT_PROGRESS } from "@vereinsheim/shot-ui/nav/routes"
import { recordRows } from "@vereinsheim/shot-ui/period/records"

import { PrismaClient } from "../src/generated/prisma/client"
import type { Db } from "../src/lib/db"
import { progressPageData } from "../src/lib/overview"
import { DEV_DATABASE_URL } from "../test/dev-database"

const TIME_ZONE = "Europe/Berlin"

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? DEV_DATABASE_URL })
const db: Db = new PrismaClient({ adapter: new PrismaPg(pool) })

const out = (text: string) => process.stdout.write(`${text}\n`)

/**
 * Einschießen je Familie eines Kontos: sichtbare Scheiben „nur Probe“ mit Familie und Scheibenbild, die vor einer
 * Scheibe derselben Familie und desselben Abends beginnen, die nicht „nur Probe“ ist (Abend in der Zone, vor 4 Uhr der
 * Vortag)
 */
async function sqlWarmup(ownerId: string): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ slug: string; n: bigint }[]>`
    with c as (
      select c.id, f.slug, c."startedAt" s, p."probeOnly" po,
        ((c."startedAt" at time zone ${TIME_ZONE}) - interval '4 hours')::date ev
      from "Card" c
      join "Discipline" d on d.id = c."disciplineId"
      join "Family" f on f.id = c."familyId"
      join "CardProjection" p on p."cardId" = c.id
      where c."ownerId" = ${ownerId} and c."deletedAt" is null and not c."ownerPending"
        and d."ignoredAt" is null and d."targetId" is not null
    )
    select w.slug, count(*) n from c w
    where w.po and exists (
      select 1 from c m where not m.po and m.slug = w.slug and m.ev = w.ev and w.s < m.s
    )
    group by w.slug`
  return new Map(rows.map((row) => [row.slug, Number(row.n)]))
}

async function main() {
  const owners = await db.card.groupBy({
    by: ["ownerId"],
    where: { ownerId: { not: null }, deletedAt: null, ownerPending: false },
    orderBy: { ownerId: "asc" },
  })
  try {
    for (const [i, { ownerId }] of owners.entries()) {
      if (!ownerId) continue
      const account = `Konto ${i + 1}`
      const context = { timeZone: TIME_ZONE, nowMs: Date.now(), named: [] }
      const { families } = await progressPageData(db, ownerId, DEFAULT_PROGRESS, context)
      for (const includeWarmup of [true, false])
        for (const { value: family } of families) {
          const query = {
            ...DEFAULT_PROGRESS,
            choice: { type: "all" as const },
            family,
            includeWarmup,
          }
          const { progress } = await progressPageData(db, ownerId, query, context)
          if (!progress) continue
          const { model, state } = progress
          const mean = model.summary.mean?.toFixed(3) ?? "–"
          const records = recordRows(model.records, state.scoring).length
          out(
            `${account} · ${family} · alle ${model.cards.length} · gezählt ${model.summary.cards} · ` +
              `Schuss ${model.summary.shots} · Ø ${mean} · Rekorde ${records}` +
              (includeWarmup ? "" : ` · nicht gezählt ${model.excludedWarmup}`)
          )
        }
      const warmup = await sqlWarmup(ownerId)
      for (const { value: family } of families) {
        out(`SQL ${account} · ${family} · Einschießen ${warmup.get(family) ?? 0}`)
      }
    }
  } finally {
    await db.$disconnect()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
