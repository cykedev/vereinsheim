// Eigene Scheiben in die Dev-Datenbank (nie in Produktion), aus `tools/private/own-cards.json` oder ohne die Datei
// erfundene (`demoCardSeeds`): Anlage „Dev-Anlage“, Quelle, Familien und Disziplinen anlegen, jede Scheibe über
// `writeRevision` schreiben (mit Projektion, zweimal ergibt nichts Neues) und alle Scheiben der Dev-Quelle einem Konto
// zuordnen.
//
//   pnpm --filter spiegel seed:own                    dem Konto aus SEED_ADMIN_EMAIL (legt die App beim Start an)
//   pnpm --filter spiegel seed:own --email <adresse>  einem anderen, vorhandenen Konto
//   pnpm --filter spiegel seed:own --demo             dem Demo-Konto (für die Prüfung im Browser, siehe unten), dazu
//                                                     erfundene Scheiben ohne Brücke in jeder Detailtiefe
//                                                     (`demoEnteredSeeds`, über `writeEnteredCard`); die ohne Werte
//                                                     wartet auf die Anlage (offener Auftrag), und eine eigene Sperre
//                                                     wartet darauf, dass „Scheibe holen“ sie aufhebt

import "dotenv/config"

import bcrypt from "bcryptjs"

import { normalizeLoginEmail } from "@vereinsheim/lib/auth/validation"
import { decodePrintoutId } from "@vereinsheim/meyton-pdf/printout-id"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import { requestSiteId } from "../src/lib/card-requests/queries"
import { createPrismaClient } from "../src/lib/db"
import { writeRevision, type RevisionChange } from "../src/lib/db/cards"
import { disciplineFor } from "../src/lib/db/disciplines"
import { writeEnteredCard } from "../src/lib/db/entered"
import { BCRYPT_COST } from "../src/lib/startup"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo-account"
import { assertDevDatabase } from "./dev-guard"
import { demoCardSeeds, demoEnteredSeeds, loadOwnCards, ownCardSeeds } from "./own-cards"

const DEV_SITE = "Dev-Anlage"
/**
 * erfundene IDs vom Ausdruck, alle aus `7fff0a00` bis `7fff0aff` (Demo und Skriptprüfung): der Auftrag der Demo-Scheibe
 * ohne Werte, die eigene Sperre für die Skriptprüfung
 */
const DEMO_REQUEST_HEX = "7fff0a00"
const DEMO_LOCK_HEX = "7fff0a03"
const DEMO_IDS = { gte: decodePrintoutId("7fff0a00"), lte: decodePrintoutId("7fff0aff") }

const out = (text = "") => process.stdout.write(`${text}\n`)

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("seed:own nur in der Entwicklung")
  const args = process.argv.slice(2)
  const demo = args.includes("--demo")
  const at = args.indexOf("--email")
  const emailArg = at >= 0 ? args[at + 1] : undefined
  if (at >= 0 && (!emailArg || emailArg.startsWith("--")))
    throw new Error("--email braucht eine Adresse")
  const email = normalizeLoginEmail(
    demo ? DEMO_EMAIL : (emailArg ?? process.env.SEED_ADMIN_EMAIL ?? "")
  )
  if (!email)
    throw new Error(
      "Kein Konto: --email <adresse> angeben oder SEED_ADMIN_EMAIL in apps/spiegel/.env setzen"
    )

  const url = process.env.DATABASE_URL ?? DEV_DATABASE_URL
  assertDevDatabase(url, args.includes("--force"))
  const db = createPrismaClient(url)
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
          // das Demo-Konto ist immer ein Schütze: `pruefen` prüft damit „Admin ohne Rolle“
          update: { isActive: true, role: "USER" },
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
    // bestätigt: Eine Brücke, die in der Entwicklung gegen die Dev-Anlage koppelt, soll gleich einliefern können (SF-23)
    const source = await db.source.upsert({
      where: { siteId_epoch: { siteId: site.id, epoch: 1 } },
      create: { siteId: site.id, epoch: 1, confirmedAt: new Date() },
      update: {},
    })
    if (!source.confirmedAt)
      await db.source.update({ where: { id: source.id }, data: { confirmedAt: new Date() } })

    const own = loadOwnCards()
    const { seeds, omitted } = own ? ownCardSeeds(own) : { seeds: demoCardSeeds(), omitted: [] }
    if (!own) out("Keine eigenen Scheiben (tools/private/own-cards.json fehlt): erfundene Scheiben")
    const changes: Record<RevisionChange, number> = {
      created: 0,
      updated: 0,
      unchanged: 0,
      stale: 0,
    }
    for (const seed of seeds) {
      const discipline = await disciplineFor(db, site.id, seed.discipline)
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

    if (demo) {
      // die neueste Scheibe der Dev-Quelle des Kontos und der Beginn ihres Abends (acht Stunden davor)
      const newest = await db.card.findFirst({
        where: { sourceId: source.id, ownerId: owner.id },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, disciplineId: true },
      })
      if (!newest) throw new Error("Keine Scheibe der Dev-Quelle für die Demo-Scheiben")
      const newestMs = newest.startedAt.getTime()
      const first = await db.card.findFirst({
        where: {
          sourceId: source.id,
          ownerId: owner.id,
          startedAt: { gte: new Date(newestMs - 8 * 3_600_000) },
        },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      })
      const entered = { created: 0, revised: 0, unchanged: 0 }
      let waiting: { cardId: string; startedAtMs: number } | null = null
      const seeds = demoEnteredSeeds({
        newestMs,
        eveningStartMs: first?.startedAt.getTime() ?? newestMs,
      })
      // Der Anker wandert mit der neuesten Scheibe: Demo-Scheiben ohne Brücke, die nicht mehr zum Satz gehören, gehen
      // vorher weg, sonst häuften sie sich. Nur am Demo-Konto, nie an echten Daten.
      const kept = (card: { origin: string; startedAt: Date; importKey: string | null }) =>
        seeds.some((seed) =>
          seed.importKey
            ? card.importKey === seed.importKey
            : card.origin === seed.origin && card.startedAt.getTime() === seed.startedAtMs
        )
      const stale = (
        await db.card.findMany({
          where: { ownerId: owner.id, sourceId: null },
          select: { id: true, origin: true, startedAt: true, importKey: true },
        })
      ).filter((card) => !kept(card))
      const { count: removed } = await db.card.deleteMany({
        where: { id: { in: stale.map((card) => card.id) } },
      })
      for (const seed of seeds) {
        // aus Treffsicher findet der Schlüssel die Scheibe, sonst Herkunft und Beginn
        const existing =
          seed.origin === "treffsicher"
            ? null
            : await db.card.findFirst({
                where: {
                  ownerId: owner.id,
                  sourceId: null,
                  origin: seed.origin,
                  startedAt: new Date(seed.startedAtMs),
                },
                select: { id: true },
              })
        const result = await writeEnteredCard(db, {
          ...(existing ? { cardId: existing.id } : {}),
          ownerId: owner.id,
          origin: seed.origin,
          disciplineId: newest.disciplineId,
          startedAtMs: seed.startedAtMs,
          kind: seed.kind,
          place: seed.place,
          importKey: seed.importKey,
          details: seed.details,
          reason: "seed",
        })
        if (result.kind === "invalid")
          throw new Error(`Demo-Scheibe ${seed.level} ungültig: ${result.problem}`)
        if (result.kind !== "saved")
          throw new Error(`Demo-Scheibe ${seed.level} nicht geschrieben: ${result.kind}`)
        entered[result.change]++
        if (seed.level === "none")
          waiting = { cardId: result.cardId, startedAtMs: seed.startedAtMs }
      }
      out(
        `Demo-Scheiben in jeder Detailtiefe: neu ${entered.created}, geändert ${entered.revised}, unverändert ${entered.unchanged}, entfernt ${removed}`
      )

      // an der Anlage, an der „Scheibe holen“ holt (die erste, `requestSiteId`): Die Scheibe ohne Werte wartet auf die
      // Anlage, und eine eigene Sperre vom 1. Oktober wartet darauf, dass ausdrückliches Holen sie aufhebt
      const fetchSiteId = (await requestSiteId(db)) ?? site.id
      const fetchSite = await db.site.findUniqueOrThrow({
        where: { id: fetchSiteId },
        select: {
          timeZone: true,
          sources: {
            where: { confirmedAt: { not: null } },
            orderBy: { epoch: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      })
      // jeder Lauf räumt Aufträge und Sperren des Demo-Kontos mit erfundenen IDs ab und legt sie neu an; Zeilen anderer
      // Konten fasst er nie an
      const requestId = decodePrintoutId(DEMO_REQUEST_HEX)
      await db.cardRequest.deleteMany({ where: { userId: owner.id, scheibenId: DEMO_IDS } })
      await db.deleteLock.deleteMany({ where: { userId: owner.id, scheibenId: DEMO_IDS } })
      if (waiting)
        await db.cardRequest.create({
          data: {
            userId: owner.id,
            siteId: fetchSiteId,
            scheibenId: requestId,
            day: eveningDay(waiting.startedAtMs, fetchSite.timeZone),
            cardId: waiting.cardId,
          },
        })
      const lockSource = fetchSite.sources[0]?.id ?? source.id
      await db.deleteLock.create({
        data: {
          userId: owner.id,
          sourceId: lockSource,
          scheibenId: decodePrintoutId(DEMO_LOCK_HEX),
          cycle: 0,
          startedAt: new Date("2026-10-01T17:00:00Z"),
        },
      })
      out(
        `Demo-Auftrag ${DEMO_REQUEST_HEX}: ${waiting ? "offen" : "ohne Scheibe, nicht angelegt"}, eigene Sperre ${DEMO_LOCK_HEX} vom 01.10.2026`
      )
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
