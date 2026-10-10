// Die echten Scheiben des Users in die Dev-Datenbank (nie in Produktion): Anlage „Dev-Anlage“, Quelle, Familien und
// Disziplinen anlegen, jede Scheibe über `writeRevision` schreiben (mit Projektion, zweimal ergibt nichts Neues) und alle
// Scheiben der Dev-Quelle einem Konto zuordnen.
//
//   pnpm --filter spiegel seed:own                    dem Konto aus SEED_ADMIN_EMAIL (legt die App beim Start an)
//   pnpm --filter spiegel seed:own --email <adresse>  einem anderen, vorhandenen Konto
//   pnpm --filter spiegel seed:own --demo             dem Demo-Konto (für die Prüfung im Browser, siehe unten)

import "dotenv/config"

import bcrypt from "bcryptjs"

import { normalizeLoginEmail } from "@vereinsheim/lib/auth/validation"

import { createPrismaClient } from "../src/lib/db"
import { writeRevision, type RevisionChange } from "../src/lib/db/cards"
import { FAMILY_NAMES } from "../src/lib/families"
import { BCRYPT_COST } from "../src/lib/startup"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { ownCardSeeds } from "./own-cards"

const DEV_SITE = "Dev-Anlage"
/** Demo-Konto nur für die Dev-Datenbank: Testzugang für die Prüfung der Seiten, kein echtes Geheimnis */
const DEMO_EMAIL = "demo@example.com"
const DEMO_PASSWORD = "spiegel-demo-konto"

const out = (text = "") => process.stdout.write(`${text}\n`)

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed:own nur in der Entwicklung")
  const args = process.argv.slice(2)
  const demo = args.includes("--demo")
  const emailArg = args.includes("--email") ? args[args.indexOf("--email") + 1] : undefined
  const email = normalizeLoginEmail(
    demo ? DEMO_EMAIL : (emailArg ?? process.env.SEED_ADMIN_EMAIL ?? "")
  )
  if (!email)
    throw new Error(
      "Kein Konto: --email <adresse> angeben oder SEED_ADMIN_EMAIL in apps/spiegel/.env setzen"
    )

  const db = createPrismaClient(process.env.DATABASE_URL ?? DEV_DATABASE_URL)
  try {
    const owner = demo
      ? await db.user.upsert({
          where: { email },
          create: {
            email,
            name: "Demo",
            passwordHash: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST),
            role: "USER",
          },
          update: { isActive: true },
          select: { id: true },
        })
      : await db.user.findUnique({ where: { email }, select: { id: true } })
    if (!owner)
      throw new Error(
        `Kein Konto ${email}: erst die App starten (legt den Admin aus SEED_ADMIN_* an) oder --email nehmen`
      )

    const site =
      (await db.site.findFirst({ where: { name: DEV_SITE } })) ??
      (await db.site.create({ data: { name: DEV_SITE, timeZone: "Europe/Berlin" } }))
    const source = await db.source.upsert({
      where: { siteId_epoch: { siteId: site.id, epoch: 1 } },
      create: { siteId: site.id, epoch: 1 },
      update: {},
    })

    const { seeds, omitted } = ownCardSeeds()
    const changes: Record<RevisionChange, number> = {
      created: 0,
      updated: 0,
      unchanged: 0,
      stale: 0,
    }
    for (const seed of seeds) {
      const family = await db.family.upsert({
        where: { slug: seed.discipline.family },
        create: { slug: seed.discipline.family, name: FAMILY_NAMES[seed.discipline.family] },
        update: {},
      })
      const discipline = await db.discipline.upsert({
        where: {
          siteId_meytonId_name: {
            siteId: site.id,
            meytonId: seed.discipline.meytonId,
            name: seed.discipline.name,
          },
        },
        create: {
          siteId: site.id,
          meytonId: seed.discipline.meytonId,
          name: seed.discipline.name,
          familyId: family.id,
          targetId: seed.discipline.targetId,
          officialScoring: seed.discipline.officialScoring,
        },
        update: {},
      })
      const result = await writeRevision(db, {
        card: { ...seed.card, sourceId: source.id, disciplineId: discipline.id, ownerId: owner.id },
        shots: seed.shots,
        reason: "seed",
      })
      changes[result.change]++
    }
    // die Zuordnung ändert eine Revision nicht: alle Scheiben der Dev-Quelle gehören dem gewählten Konto
    const { count } = await db.card.updateMany({
      where: { sourceId: source.id },
      data: { ownerId: owner.id },
    })

    out(
      `Eigene Scheiben in ${DEV_SITE}: ${seeds.length} geschrieben, ${count} dem Konto ${email} zugeordnet`
    )
    out(
      `  neu ${changes.created}, geändert ${changes.updated}, unverändert ${changes.unchanged}, veraltet ${changes.stale}`
    )
    for (const { n, reason } of omitted) out(`  weggelassen: Scheibe ${n} (${reason})`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
