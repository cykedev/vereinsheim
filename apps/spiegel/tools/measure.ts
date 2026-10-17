// Messung an der Dev-Datenbank (ADR-031), nicht im Gate: das Volumen „sehr aktiv, 5 Jahre“ schreiben, dann
// die Zugriffe der Ansichten messen (Median über mehrere Läufe) und die Pläne der Abfragen zeigen (EXPLAIN ANALYZE).
// Dazu andere Mitglieder, damit die Tabellen so groß sind wie an einer Vereinsanlage (rund 750 Scheiben im Jahr).
// Aufruf: pnpm --filter spiegel measure [--cards 1564] [--others 2200] [--runs 15] [--keep]

import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { cardValues, periodRecords, type PeriodCard } from "@vereinsheim/shot-core/analysis"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { projectedRecords, projectedValues } from "@vereinsheim/shot-core/projection"
import { DEFAULT_LIST, DEFAULT_PROGRESS } from "@vereinsheim/shot-ui/nav/routes"

import { PrismaClient } from "../src/generated/prisma/client"
import { writeRevision } from "../src/lib/db/cards"
import { cardWithShots, familyCards, latestCardStart, ownerCards } from "../src/lib/db/reads"
import { listPageData, progressPageData, startPageData } from "../src/lib/overview"
import type { Db } from "../src/lib/db"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { createTestSite } from "../test/fixtures"
import { generateSeason, liveStates } from "../test/generate"

const args = process.argv.slice(2)
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const CARDS = option("cards", 1564)
const OTHERS = option("others", 2200)
const MEMBERS = 20
const RUNS = option("runs", 15)
const KEEP = args.includes("--keep")
const DAY_MS = 86_400_000
/** Ausgabe als Markdown, erst nach dem Aufräumen geschrieben: Bricht die Ausgabe ab (`| head`), bleibt nichts liegen */
const lines: string[] = []
const out = (text = "") => lines.push(text)

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? DEV_DATABASE_URL })
const db: Db = new PrismaClient({ adapter: new PrismaPg(pool) })
// ein zweiter Client, der seine SQL-Anweisungen meldet: für EXPLAIN genau die Abfragen, die Prisma schickt
const queries: { query: string; params: string }[] = []
const logging = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: [{ emit: "event", level: "query" }],
})
logging.$on("query", (event) => queries.push({ query: event.query, params: event.params }))
const loggingDb = logging as unknown as Db

async function median(run: () => Promise<unknown>): Promise<number> {
  await run()
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now()
    await run()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

/** die SQL-Anweisungen eines Zugriffs, wie Prisma sie schickt */
async function captured(run: (db: Db) => Promise<unknown>) {
  queries.length = 0
  await run(loggingDb)
  return queries.filter((q) => /^\s*SELECT/i.test(q.query)).map((q) => ({ ...q }))
}

async function explain(label: string, run: (db: Db) => Promise<unknown>) {
  for (const { query, params } of await captured(run)) {
    const values = JSON.parse(params) as unknown[]
    const plan = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) ${query}`, values)
    // lange Listen von Kennungen gekürzt
    const steps = plan.rows.map((r: Record<string, string>) => r["QUERY PLAN"].slice(0, 160))
    out(`\n### ${label}\n`)
    out("```")
    out(query.replace(/"public"\./g, "").slice(0, 400))
    out("--")
    out(steps.join("\n"))
    out("```")
  }
}

async function main() {
  const site = await createTestSite(db, "messung")
  const members: string[] = []
  try {
    const firstMs = Date.UTC(2021, 9, 1, 16, 30)
    const inputs = generateSeason({
      seed: 20261010,
      cards: CARDS,
      firstMs,
      everyDays: (5 * 365) / (CARDS / 3),
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: 100_000,
    })
    const shots = inputs.reduce((n, i) => n + i.shots.length, 0)
    out(
      `# Messung: ${CARDS} Scheiben mit ${shots} Schuss, dazu ${OTHERS} Scheiben von ${MEMBERS} anderen; ` +
        `${RUNS} Läufe je Zugriff (Median)\n`
    )

    const start = performance.now()
    for (const input of inputs) await writeRevision(db, input)
    for (let m = 0; m < MEMBERS; m++) {
      const member = await db.user.create({
        data: {
          email: `messung-${site.siteId}-${m}@example.com`,
          name: `Mitglied ${m + 1}`,
          passwordHash: "-",
        },
      })
      members.push(member.id)
      const others = generateSeason({
        seed: 1000 + m,
        cards: Math.round(OTHERS / MEMBERS),
        firstMs: firstMs + m * 3_600_000,
        everyDays: (5 * 365) / (OTHERS / MEMBERS / 3),
        sourceId: site.sourceId,
        disciplineId: site.disciplineId,
        ownerId: member.id,
        scheibenIdBase: 200_000 + m * 10_000,
      })
      for (const input of others) await writeRevision(db, input)
    }
    const writeMs = performance.now() - start
    for (const table of ["Card", "CardRevision", "Shot", "CardProjection"])
      await pool.query(`ANALYZE "${table}"`)

    const owner = { ownerId: site.ownerId, familyId: site.familyId }
    const lastMs = (await latestCardStart(db, site.ownerId))!
    const overview = await familyCards(db, owner)
    const sample = overview[Math.floor(overview.length / 2)].id

    // Gegenstück ohne Projektion: jede Scheibe der Familie mit allen Schüssen laden
    const allShots = () =>
      db.card.findMany({
        where: { ...owner, deletedAt: null },
        orderBy: { startedAt: "asc" },
        select: { id: true, currentRevision: { select: { shots: true } } },
      })
    const full: PeriodCard[] = []
    const one = (cardId: string) => cardWithShots(db, { cardId, ownerId: site.ownerId })
    for (const { id } of overview) full.push((await one(id))!)
    const mean = metricByKey("result.decimalMean") as MetricDefinition

    // Start und Liste wie die Seiten: Scheiben mit Projektion lesen, das Modell auf dem Server rechnen, die
    // Lagen der gezeigten Scheiben lesen; an den Browser geht nur, was die Funktion zurückgibt
    const pageContext = {
      timeZone: "Europe/Berlin",
      nowMs: lastMs + DAY_MS,
      named: [],
    }
    const startPage = () => startPageData(db, site.ownerId, pageContext)
    const listPage = () => listPageData(db, site.ownerId, DEFAULT_LIST, pageContext)
    const progressPage = () =>
      progressPageData(
        db,
        site.ownerId,
        { ...DEFAULT_PROGRESS, choice: { type: "all" } },
        pageContext
      )

    // offener Durchgang: die Brücke schickt nach jedem Schuss den ganzen Stand (SF-03)
    const live = generateSeason({
      seed: 42,
      cards: 6,
      firstMs: lastMs + DAY_MS,
      everyDays: 1,
      sourceId: site.sourceId,
      disciplineId: site.disciplineId,
      ownerId: site.ownerId,
      scheibenIdBase: 900_000,
    }).find((input) => input.card.kind === "competition")!
    // wie an der Anlage: erst die Probe, der erste Wertungsschuss löscht sie (SF-03)
    const states = liveStates(live)
    const perShot: number[] = []
    for (const shots of states) {
      const t = performance.now()
      await writeRevision(db, { ...live, shots })
      perShot.push(performance.now() - t)
    }
    perShot.sort((a, b) => a - b)
    const liveCard = await db.card.findUniqueOrThrow({
      where: {
        sourceId_scheibenId_cycle_block: {
          sourceId: site.sourceId,
          scheibenId: live.card.scheibenId!,
          cycle: 0,
          block: 0,
        },
      },
      select: { _count: { select: { shots: true, revisions: true } } },
    })

    const rows: [string, number][] = [
      ["Schreiben je Scheibe (Revision, Schüsse, Projektion)", writeMs / (CARDS + OTHERS)],
      [
        `offener Durchgang: ein Schuss mehr (${states.length} Stände mit Probe; danach ` +
          `${liveCard._count.revisions} Revision, ${liveCard._count.shots} Schusszeilen)`,
        perShot[Math.floor(perShot.length / 2)],
      ],
      ["Fortschritt „Alles“: Scheiben mit Projektion", await median(() => familyCards(db, owner))],
      [
        "Fortschritt 90 Tage: Scheiben mit Projektion",
        await median(() => familyCards(db, { ...owner, fromMs: lastMs - 90 * DAY_MS })),
      ],
      [
        "dieselbe Übersicht direkt über pg (eine Abfrage mit Join, ohne Prisma)",
        await median(() =>
          pool.query(
            `SELECT c.id, c."startedAt", c.kind, c.complete, c.flags, d."officialScoring", c.state,
                    c.stand, c."disciplineId", c."familyId", p.version, p."probeOnly", p.suspicious,
                    p."printedShots", p.values, p.records
               FROM "Card" c JOIN "CardProjection" p ON p."cardId" = c.id
               JOIN "Discipline" d ON d.id = c."disciplineId"
              WHERE c."ownerId" = $1 AND c."familyId" = $2 AND c."deletedAt" IS NULL
              ORDER BY c."startedAt", c.id`,
            [site.ownerId, site.familyId]
          )
        ),
      ],
      [
        "Start: neueste Scheibe und ihr Abend",
        await median(async () => {
          const latest = (await latestCardStart(db, site.ownerId))!
          return ownerCards(db, { ownerId: site.ownerId, fromMs: latest - DAY_MS / 2 })
        }),
      ],
      ["Start auf dem Server: lesen, Modell rechnen, Lagen des Abends", await median(startPage)],
      [
        "Liste „Alles“ auf dem Server: lesen, Modell rechnen, Lagen der gezeigten",
        await median(listPage),
      ],
      [
        "Fortschritt „Alles“ auf dem Server: lesen, Modell rechnen, leicht machen",
        await median(progressPage),
      ],
      ["Seite einer Scheibe: Schüsse der Revision", await median(() => one(sample))],
      ["ohne Projektion: alle Schüsse der Familie laden", await median(allShots)],
      [
        "Rechnen aus der Projektion: Ø je Scheibe und Rekorde",
        await median(async () => {
          projectedValues(overview, mean, "decimal")
          projectedRecords(overview, "decimal")
        }),
      ],
      [
        "Rechnen aus den Schüssen: Ø je Scheibe und Rekorde",
        await median(async () => {
          cardValues(full, mean, "decimal")
          periodRecords(full, "decimal")
        }),
      ],
    ]
    out("| Zugriff | ms |\n| --- | --- |")
    for (const [label, ms] of rows) out(`| ${label} | ${ms.toFixed(1)} |`)

    out(`\nScheiben in der Datenbank: ${await db.card.count()}`)
    const sizes = await pool.query(
      `SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS size
       FROM pg_class WHERE relname IN ('Card', 'CardRevision', 'Shot', 'CardProjection') ORDER BY relname`
    )
    const projection = await pool.query(
      `SELECT round(avg(pg_column_size(values) + pg_column_size(records))) AS bytes FROM "CardProjection"`
    )
    out("\n| Tabelle | Größe |\n| --- | --- |")
    for (const r of sizes.rows) out(`| ${r.relname} | ${r.size} |`)
    out(`\nProjektion je Scheibe im Mittel: ${projection.rows[0].bytes} Byte (Werte und Rekorde)`)
    // was an den Browser geht, als JSON: vorher alle Scheiben mit Schüssen, jetzt Modell und Lagen der gezeigten
    const kb = (value: unknown) => (JSON.stringify(value).length / 1024).toFixed(0)
    out("\n| an den Browser (JSON) | KB |\n| --- | --- |")
    out(`| vorher: alle Scheiben der Familie mit Schüssen | ${kb(full)} |`)
    out(`| Start: Modell und Lagen des Abends | ${kb(await startPage())} |`)
    out(`| Liste „Alles“: Modell und Lagen aller gezeigten | ${kb(await listPage())} |`)
    // die Abstände sind eine Map, die JSON nicht mitzählt: als Einträge, wie sie an den Browser gehen
    const { progress, families } = await progressPage()
    const progressJson = {
      ...progress,
      model: { ...progress!.model, deltas: [...progress!.model.deltas] },
      families,
    }
    out(`| Fortschritt „Alles“: leichtes Modell und Lagen der Ablesung | ${kb(progressJson)} |`)

    await explain("Fortschritt „Alles“", (client) => familyCards(client, owner))
    await explain("Fortschritt 90 Tage", (client) =>
      familyCards(client, { ...owner, fromMs: lastMs - 90 * DAY_MS })
    )
    await explain("Start: neueste Scheibe", (client) => latestCardStart(client, site.ownerId))
    await explain("Start: der Abend", (client) =>
      ownerCards(client, { ownerId: site.ownerId, fromMs: lastMs - DAY_MS / 2 })
    )
    await explain("Seite einer Scheibe", (client) =>
      cardWithShots(client, { cardId: sample, ownerId: site.ownerId })
    )
  } finally {
    if (!KEEP) {
      await site.remove()
      await db.user.deleteMany({ where: { id: { in: members } } })
    }
    await db.$disconnect()
    await logging.$disconnect()
    await pool.end()
    process.stdout.write(`${lines.join("\n")}\n`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
