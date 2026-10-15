// Ende zu Ende mit der echten Brücke: der eigene Build von
// Spiegel auf :3012, eine eigene Anlage mit Zustimmung für den erfundenen Sportpass 12345678, MariaDB 10.6 in Docker mit
// den Fällen SF-03 (Zustimmung), SF-13 (frei, ohne Treffer, fremder Schütze, Muster) und SF-19 (verdeckt). Das Binary
// aus `apps/spiegel-bridge` koppelt über HTTP und läuft. Der erste Stand weckt die Brücke aus dem ruhigen Takt (30 s),
// danach kommen die Schritte der Fälle im Abstand von vier Sekunden; sie liest dann jede Sekunde.
// Geprüft in der Datenbank: Was ankommt, gehört dem Konto mit Zustimmung, nichts Verdecktes und nichts ohne Zustimmung,
// der Heartbeat ist vermerkt. Danach ist alles entfernt (Anlage, Konto, Container, Konfiguration mit dem Token).
// Dazu ein älterer Abend (SF-02, 40 Tage zurück) schon vor dem Start in der Ablage: Ohne Auftrag zum Nachladen
// (`historyLoadedAt` gesetzt) kommt er nie. Mit `--historie` ist der Auftrag offen; die Brücke holt ihn, sobald 20 Minuten
// nichts läuft, und meldet ihn erledigt (`historyLoadedAt`). Das dauert gut 20 Minuten.
// Nicht im Gate (braucht Docker, Go und den Build).
// Mit `BASE_URL` gegen einen laufenden Spiegel statt des eigenen Builds, mit `DATABASE_URL` dessen Datenbank (etwa
// der Stack aus `tools/stack-e2e/run.sh --bridge`, Spiegel hinter Caddy).
//
//   pnpm --filter spiegel build && pnpm --filter spiegel bridge-e2e [--historie]
//   BASE_URL=http://localhost:18082 DATABASE_URL=… pnpm --filter spiegel bridge-e2e

import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { zonedWallTimeMs } from "@vereinsheim/lib/format"

import { createPrismaClient } from "../src/lib/db"
import { createPairing } from "../src/lib/ingest/bridges"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { APP_DIR, startServer } from "./pruefen/server"

const out = (text = "") => process.stdout.write(`${text}\n`)
const PORT = 3012
/** ein laufender Spiegel (etwa hinter Caddy im Stack); dann ohne eigenen Server */
const EXTERNAL = process.env.BASE_URL ?? null
const BASE = EXTERNAL ?? `http://localhost:${PORT}`
const BRIDGE_DIR = join(APP_DIR, "..", "spiegel-bridge")
const CASES_DIR = join(APP_DIR, "..", "..", "packages", "ssmdb2-cases", "cases", "v1")
const CONSENTED = BigInt(12345678)
const STEP_MS = 4000
/** Scheiben der Fälle, die ankommen dürfen bzw. nie */
const ARRIVE = [1168956429, 651756429, -1915210867, -1912810867]
const NEVER = [650556429, 650556430]
const HIDDEN = [-1916410867, -1915210867, -1912810867]
/** der ältere Abend (SF-02): nur mit offenem Auftrag zum Nachladen */
const OLDER = 1082556429
const OLDER_DAYS = 40

/** Anlage und Konto behalten, um nachzusehen; Container und Konfiguration gehen trotzdem */
const KEEP = process.argv.includes("--keep")
/** mit offenem Auftrag zum Nachladen; wartet, bis die Brücke ihn erledigt meldet (gut 20 Minuten) */
const HISTORY = process.argv.includes("--historie")
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function mariadb(container: string, sql: string, database = "SSMDB2") {
  const result = spawnSync(
    "docker",
    ["exec", "-i", container, "mariadb", "--skip-ssl", "-uroot", "-proot", database],
    { input: sql, encoding: "utf8", timeout: 60_000 }
  )
  if (result.status !== 0) throw new Error(`SQL: ${result.stderr}`)
}

function startMariadb(container: string): number {
  execFileSync("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "-e",
    "MARIADB_ROOT_PASSWORD=root",
    "-p",
    "127.0.0.1::3306",
    "mariadb:10.6",
    "--skip-ssl",
  ])
  for (let i = 0; i < 90; i++) {
    const ready = spawnSync("docker", [
      "exec",
      container,
      "healthcheck.sh",
      "--connect",
      "--innodb_initialized",
    ])
    if (ready.status === 0) break
    execFileSync("sleep", ["1"])
  }
  mariadb(container, "CREATE DATABASE SSMDB2;", "mysql")
  mariadb(container, readFileSync(join(CASES_DIR, "..", "..", "schema", "ssmdb2.sql"), "utf8"))
  const port = execFileSync("docker", ["port", container, "3306/tcp"], { encoding: "utf8" })
  return Number(port.trim().split("\n")[0].split(":").at(-1))
}

const DATETIME = /'(20\d\d-\d\d-\d\d \d\d:\d\d:\d\d)'/g
const wallMs = (text: string) => Date.parse(`${text.replace(" ", "T")}Z`)
const wallText = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ")

/**
 * Die Schritte eines Falls, alle Zeiten so verschoben, dass sein erster Stand jetzt ist (Ortszeit der Anlage). Die Fälle
 * sind auf Tage im Oktober datiert; Spiegel mäße sonst Tage Uhrversatz, und der Heartbeat schaltete die Scheibe
 * endgültig, bevor der nächste Stand kommt (dann ein neuer Zyklus, SF-77).
 */
function steps(id: string, daysBack = 0): string[] {
  const sqls = readdirSync(join(CASES_DIR, id, "steps"))
    .sort()
    .map((file) => readFileSync(join(CASES_DIR, id, "steps", file), "utf8"))
  const first = Math.min(
    ...sqls.flatMap((sql) => [...sql.matchAll(DATETIME)].map((m) => wallMs(m[1])))
  )
  const now = Date.now()
  const nowWall = now + (now - zonedWallTimeMs(now, "Europe/Berlin"))
  const shift = Math.round((nowWall - daysBack * 86_400_000 - first) / 1000) * 1000
  return sqls.map((sql) =>
    sql.replace(DATETIME, (_, text: string) => `'${wallText(wallMs(text) + shift)}'`)
  )
}

async function main() {
  // gegen einen fremden Spiegel nie dessen Anlage in der Dev-Datenbank anlegen
  if (EXTERNAL && !process.env.DATABASE_URL) {
    out("Mit BASE_URL auch DATABASE_URL setzen (die Datenbank dieses Spiegels).")
    process.exit(2)
  }
  const db = createPrismaClient(process.env.DATABASE_URL ?? DEV_DATABASE_URL)
  const tag = randomUUID().slice(0, 8)
  const container = `spiegel-bridge-e2e-${tag}`
  const dir = mkdtempSync(join(tmpdir(), "spiegel-bridge-e2e-"))
  let server: ChildProcess | null = null
  let bridge: ChildProcess | null = null
  let bridgeLog = ""
  const site = await db.site.create({ data: { name: `Brücke ${tag}`, timeZone: "Europe/Berlin" } })
  const user = await db.user.create({
    data: { email: `bruecke-${tag}@example.com`, passwordHash: "-" },
  })
  const problems: string[] = []
  try {
    await db.sportpassConsent.create({
      // eingespielt: die erste Scheibe ist bestätigt; hier zählt das Hochladen
      data: {
        userId: user.id,
        siteId: site.id,
        sportpassId: CONSENTED,
        confirmedAt: new Date(),
        firstCardConfirmedAt: new Date(),
        // ohne `--historie` gilt die Historie als geladen: kein Auftrag
        historyLoadedAt: HISTORY ? null : new Date(),
      },
    })
    if (!EXTERNAL) server = await startServer(BASE, PORT, out)
    const port = startMariadb(container)
    // der ältere Abend liegt schon in der Ablage, bevor die Brücke startet
    for (const sql of steps("SF-02", OLDER_DAYS)) mariadb(container, sql)
    const binary = join(dir, "spiegel-bridge")
    execFileSync("go", ["build", "-o", binary, "./cmd/spiegel-bridge"], { cwd: BRIDGE_DIR })
    const { code } = await createPairing(db, {
      siteId: site.id,
      name: `E2E ${tag}`,
      createdById: null,
    })
    const env = { ...process.env, SPIEGEL_BRIDGE_DSN: `root:root@tcp(127.0.0.1:${port})/SSMDB2` }
    const config = join(dir, "config.json")
    execFileSync(binary, ["pair", "--config", config, "--url", BASE, "--code", code], { env })
    out("gekoppelt")

    // der erste Stand des Abends schon vor dem Start: Er verankert das Startfenster der Brücke am heutigen Abend, sonst
    // gälte der ältere Abend (allein in der Ablage) als der jüngste und käme ohne Auftrag
    const [first, ...rest] = steps("SF-03")
    mariadb(container, first)
    bridge = spawn(binary, ["run", "--config", config], { env })
    bridge.stderr?.on("data", (chunk: Buffer) => (bridgeLog += chunk.toString()))
    // die Schritte im Takt eines Abends, nur schneller: die Brücke sieht jeden Stand mindestens zweimal
    await sleep(32_000)
    for (const [id, sqls] of [
      ["SF-03", rest],
      ["SF-13", steps("SF-13")],
      ["SF-19", steps("SF-19")],
    ] as const) {
      for (const sql of sqls) {
        mariadb(container, sql)
        await sleep(STEP_MS)
      }
      out(`${id} gespielt`)
    }
    await sleep(STEP_MS)

    const sources = await db.source.findMany({ where: { siteId: site.id }, select: { id: true } })
    const raw = await db.rawSnapshot.findMany({
      where: { sourceId: { in: sources.map((s) => s.id) } },
      select: { scheibenId: true },
      distinct: ["scheibenId"],
    })
    const arrived = raw.map((r) => r.scheibenId).sort((a, b) => a - b)
    out(`angekommen: ${arrived.join(", ")}`)
    for (const id of ARRIVE) if (!arrived.includes(id)) problems.push(`Scheibe ${id} fehlt`)
    for (const id of NEVER)
      if (arrived.includes(id))
        problems.push(`Scheibe ${id} hätte das Schützenhaus nie verlassen dürfen`)
    if (!HISTORY && arrived.includes(OLDER))
      problems.push(`der ältere Abend kam ohne Auftrag zum Nachladen`)
    const cards = await db.card.findMany({
      where: { source: { siteId: site.id } },
      select: { scheibenId: true, ownerId: true, _count: { select: { shots: true } } },
    })
    for (const card of cards) {
      if (card.ownerId !== user.id) problems.push(`Scheibe ${card.scheibenId} ohne das Konto`)
      if (cards.filter((c) => c.scheibenId === card.scheibenId).length > 1)
        problems.push(`Scheibe ${card.scheibenId} doppelt (neuer Zyklus)`)
    }
    const sf03 = cards.find((c) => c.scheibenId === 1168956429)
    if (!sf03 || sf03._count.shots < 20) problems.push(`SF-03: ${sf03?._count.shots ?? 0} Schüsse`)
    const hiddenShots = await db.shot.count({
      where: { card: { source: { siteId: site.id } }, displayMode: { in: [0, 5, 10] } },
    })
    if (hiddenShots) problems.push(`${hiddenShots} verdeckte Schüsse in Spiegel`)
    const hidden = cards.filter((c) => HIDDEN.includes(c.scheibenId ?? 0)).length
    out(`SF-19: ${hidden} Scheiben mit Ständen vor dem ersten verdeckten Schuss`)
    // der nächste Heartbeat (einmal je Minute) meldet die zurückgehaltenen Scheiben
    let registered: { lastHeartbeatAt: Date | null; heartbeat: unknown } | null = null
    for (let i = 0; i < 40; i++) {
      registered = await db.bridge.findFirst({
        where: { siteId: site.id },
        select: { lastHeartbeatAt: true, heartbeat: true },
      })
      if (JSON.stringify(registered?.heartbeat ?? {}).includes('"displayMode":5')) break
      await sleep(2000)
    }
    if (!JSON.stringify(registered?.heartbeat ?? {}).includes('"displayMode":5'))
      problems.push("Heartbeat ohne zurückgehaltene verdeckte Scheibe")
    const heartbeat = JSON.stringify(registered?.heartbeat ?? null)
    if (!registered?.lastHeartbeatAt) problems.push("kein Heartbeat")
    if (/Muster|12345678/.test(heartbeat + bridgeLog))
      problems.push("Personenfeld in Heartbeat oder Log")
    out(`Heartbeat: ${heartbeat}`)
    if (HISTORY) {
      // die Brücke lädt erst nach, wenn 20 Minuten nichts läuft; danach meldet der Heartbeat den Auftrag erledigt
      out("warte auf das Nachladen (bis 26 min)")
      let loaded: Date | null = null
      for (let i = 0; i < 26 * 6 && !loaded; i++) {
        await sleep(10_000)
        loaded = (
          await db.sportpassConsent.findFirstOrThrow({
            where: { siteId: site.id },
            select: { historyLoadedAt: true },
          })
        ).historyLoadedAt
      }
      const older = await db.card.findFirst({
        where: { source: { siteId: site.id }, scheibenId: OLDER },
        select: { ownerId: true, startedAt: true },
      })
      if (!older) problems.push("der ältere Abend kam nicht")
      else if (older.ownerId !== user.id) problems.push("der ältere Abend ohne das Konto")
      if (!loaded) problems.push("der Auftrag zum Nachladen ist nicht erledigt gemeldet")
      out(
        `nachgeladen: ${older ? older.startedAt.toISOString() : "nichts"}, erledigt ${loaded?.toISOString() ?? "nein"}`
      )
    }
    out(`Log der Brücke:\n${bridgeLog.trim()}`)
  } finally {
    bridge?.kill("SIGTERM")
    server?.kill()
    spawnSync("docker", ["rm", "-f", container])
    rmSync(dir, { recursive: true, force: true })
    if (KEEP) out(`behalten: Anlage ${site.id}, Konto ${user.email}`)
    else {
      await db.card.deleteMany({ where: { source: { siteId: site.id } } })
      await db.site.delete({ where: { id: site.id } })
      await db.user.delete({ where: { id: user.id } })
    }
    await db.$disconnect()
  }
  if (problems.length) {
    process.stderr.write(`${problems.join("\n")}\n`)
    process.exit(1)
  }
  out("Ende zu Ende: in Ordnung")
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
