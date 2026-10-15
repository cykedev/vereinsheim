// Lastskript der Ingest-API: ein Trainingsabend mit mehreren belegten
// Ständen, gebaut mit dem Baukasten der Sonderfälle (`@vereinsheim/ssmdb2-cases/stand`): Probe, 40 Schuss im Takt der
// Vereinsanlage, Lebenszeichen alle 7 s. Gespielt wie eine Brücke: jede Sekunde lesen, jeden geänderten Stand in einem
// Stapel schicken, `Retry-After` beachten, jede Minute ein Heartbeat. Gemessen: Antwortzeiten, Ergebnisse, Wachstum der
// Rohdaten, Speicher des Servers (mit `--start`). Nicht im Gate; legt eine eigene Anlage an und räumt sie wieder weg.
//
//   pnpm --filter spiegel ingest-load --start [--lanes 12] [--minutes 20] [--speed 1] [--keep]

import { randomUUID } from "node:crypto"
import { execFileSync, type ChildProcess } from "node:child_process"

import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { readingSnapshots } from "@vereinsheim/ssmdb2-cases/output"
import { Sim, type Card } from "@vereinsheim/ssmdb2-cases/stand"
import { LP_10M } from "@vereinsheim/shot-core/targets"

import { createPrismaClient } from "../src/lib/db"
import { createPairing } from "../src/lib/ingest/bridges"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { startServer } from "./pruefen/server"

const out = (text = "") => process.stdout.write(`${text}\n`)
const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : fallback
}
const LANES = arg("lanes", 12)
const MINUTES = arg("minutes", 20)
/** wie schnell gespielt wird: 1 ist Echtzeit (eine Lesung je Sekunde), wie eine echte Brücke */
const SPEED = arg("speed", 1)
const START = process.argv.includes("--start")
const KEEP = process.argv.includes("--keep")
/** Speicher eines Containers messen (`docker stats`), etwa des Standalone-Builds mit `--memory=256m` */
const DOCKER = (() => {
  const i = process.argv.indexOf("--docker")
  return i >= 0 ? process.argv[i + 1] : null
})()
const PORT = 3012
const BASE = START ? `http://localhost:${PORT}` : (process.env.BASE_URL ?? "http://localhost:3002")
const SPORTPASS_BASE = 990_000_000_000

/** fester Zufall, damit Läufe vergleichbar sind */
function random(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (rnd: () => number) =>
  Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())

interface Lane {
  card: Card
  /** Sekunde des nächsten Schusses, null: fertig */
  nextShot: number | null
  probe: number
  match: number
  lastSent: string | null
}

/** die Lesungen eines Abends als Stapel der Brücke: je Sekunde die Stände, die sich seit dem letzten Senden änderten */
function* evening(startMs: number, sportpass: (lane: number) => number) {
  const rnd = random(20261013)
  const sim = new Sim(startMs)
  const lanes: Lane[] = Array.from({ length: LANES }, (_, i) => ({
    card: sim.card({
      scheibenId: 1_000_000 + i * 7919,
      disziplinId: 19210040,
      disziplin: "LP 40 alt",
      target: LP_10M,
      display: 2,
      standNr: i + 1,
      person: { SportpassID: sportpass(i), Nachname: `Last${i}`, Vorname: "Test" },
    }),
    // die Stände beginnen gestaffelt in den ersten zehn Minuten
    nextShot: Math.floor(rnd() * 600) + 20,
    probe: 5 + Math.floor(rnd() * 10),
    match: 0,
    lastSent: null,
  }))
  for (let second = 1; second <= MINUTES * 60; second++) {
    sim.advance(1_000)
    for (const lane of lanes) {
      if (lane.nextShot !== null && second >= lane.nextShot) {
        const probe = lane.probe > 0
        const sigma = 500
        lane.card.shot(
          probe ? 0 : 1,
          Math.round(gauss(rnd) * sigma),
          Math.round(gauss(rnd) * sigma)
        )
        if (probe) lane.probe--
        else lane.match++
        // Takt der Vereinsanlage: im Median 32 s zwischen zwei Schüssen
        lane.nextShot = lane.match >= 40 ? null : second + 20 + Math.floor(rnd() * 25)
      }
      // das Lebenszeichen läuft alle 7 s, solange der Stand belegt ist
      if (second % 7 === lane.card.id % 7) lane.card.heartbeat()
    }
    sim.read(`Sekunde ${second}`)
    const [reading] = readingSnapshots(sim.readings)
    sim.readings.length = 0
    const changed: SnapshotV1[] = []
    for (const snapshot of reading.snapshots) {
      const lane = lanes.find((l) => l.card.id === snapshot.scheibenId)!
      if (snapshot.checksum === lane.lastSent) continue
      if (!snapshot.data.treffer.rows.length) continue
      lane.lastSent = snapshot.checksum
      changed.push(snapshot)
    }
    yield { second, snapshots: changed }
  }
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

/** Speicher eines Containers in MiB, wie `docker stats` ihn zählt */
function containerMiB(name: string): number | null {
  try {
    const usage = execFileSync(
      "docker",
      ["stats", "--no-stream", "--format", "{{.MemUsage}}", name],
      {
        encoding: "utf8",
      }
    )
    const match = /([\d.]+)\s*(KiB|MiB|GiB)/.exec(usage)
    if (!match) return null
    const factor = { KiB: 1 / 1024, MiB: 1, GiB: 1024 }[match[2] as "KiB" | "MiB" | "GiB"]
    return Math.round(Number(match[1]) * factor)
  } catch {
    return null
  }
}

/** Speicher des Servers und seiner Kinder in MiB (RSS, macOS zählt anders als ein Container) */
function rssMiB(pid: number): number | null {
  try {
    const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number))
    const tree = new Set([pid])
    for (let changed = true; changed; ) {
      changed = false
      for (const [p, parent] of rows)
        if (tree.has(parent) && !tree.has(p)) {
          tree.add(p)
          changed = true
        }
    }
    return Math.round(
      rows.filter(([p]) => tree.has(p)).reduce((sum, [, , rss]) => sum + rss, 0) / 1024
    )
  } catch {
    return null
  }
}

async function main() {
  const db = createPrismaClient(process.env.DATABASE_URL ?? DEV_DATABASE_URL)
  const tag = randomUUID().slice(0, 8)
  let server: ChildProcess | null = null
  const site = await db.site.create({
    data: { name: `Lasttest ${tag}`, timeZone: "Europe/Berlin" },
  })
  const user = await db.user.create({
    data: { email: `last-${tag}@example.com`, passwordHash: "-" },
  })
  try {
    await db.sportpassConsent.createMany({
      data: Array.from({ length: LANES }, (_, i) => ({
        userId: user.id,
        siteId: site.id,
        sportpassId: BigInt(SPORTPASS_BASE + i),
        confirmedAt: new Date(),
        // eingespielt: gemessen wird die Last, nicht die erste Bestätigung
        firstCardConfirmedAt: new Date(),
      })),
    })
    if (START) server = await startServer(BASE, PORT, out)
    const { code } = await createPairing(db, {
      siteId: site.id,
      name: `Last ${tag}`,
      createdById: null,
    })
    const pair = await fetch(`${BASE}/api/ingest/v1/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: 1, code, name: null, bridgeVersion: "last" }),
    })
    if (!pair.ok) throw new Error(`Kopplung: ${pair.status} ${await pair.text()}`)
    const { token } = (await pair.json()) as { token: string }
    const headers = { "content-type": "application/json", authorization: `Bearer ${token}` }

    const latencies: number[] = []
    const outcomes = new Map<string, number>()
    const memory: number[] = []
    let requests = 0
    let snapshots = 0
    let bytes = 0
    let retried = 0
    const startMs = Date.now() - MINUTES * 60_000 - 60_000
    const runStartedAt = new Date().toISOString()
    out(`${LANES} Stände, ${MINUTES} min Abend, Tempo ${SPEED}, gegen ${BASE}`)
    for (const step of evening(startMs, (i) => SPORTPASS_BASE + i)) {
      const tick = Date.now()
      if (step.snapshots.length) {
        const body = JSON.stringify({ snapshots: step.snapshots.slice(0, 50) })
        for (;;) {
          const sent = Date.now()
          const response = await fetch(`${BASE}/api/ingest/v1/snapshots`, {
            method: "POST",
            headers,
            body,
          })
          latencies.push(Date.now() - sent)
          requests++
          if (response.status === 429 || response.status === 503) {
            retried++
            const wait = Number(response.headers.get("retry-after") ?? "1")
            await new Promise((resolve) => setTimeout(resolve, wait * 1000))
            continue
          }
          if (!response.ok) throw new Error(`Stapel: ${response.status} ${await response.text()}`)
          const result = (await response.json()) as { results: { outcome: string }[] }
          for (const r of result.results)
            outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1)
          snapshots += step.snapshots.length
          bytes += body.length
          break
        }
      }
      if (step.second % 60 === 0) {
        await fetch(`${BASE}/api/ingest/v1/heartbeat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            contractVersion: 1,
            bridgeVersion: "last",
            runStartedAt,
            sentAt: new Date().toISOString(),
            status: "ok",
            backlog: 0,
            lastDbContactAt: new Date().toISOString(),
            queryMs: 5,
            sourceClockOffsetMs: 0,
            heldBack: [],
            sourceFingerprint: null,
          }),
        })
        const mib = DOCKER ? containerMiB(DOCKER) : server?.pid ? rssMiB(server.pid) : null
        if (mib !== null) memory.push(mib)
        out(
          `  min ${step.second / 60}: ${requests} Anfragen, p95 ${percentile(latencies, 95)} ms${memory.length ? `, Server ${memory.at(-1)} MiB` : ""}`
        )
      }
      const spare = 1000 / SPEED - (Date.now() - tick)
      if (spare > 0) await new Promise((resolve) => setTimeout(resolve, spare))
    }

    const sourceIds = (
      await db.source.findMany({ where: { siteId: site.id }, select: { id: true } })
    ).map((s) => s.id)
    const [rawSnapshots, rawRows, cards, shots] = await Promise.all([
      db.rawSnapshot.count({ where: { sourceId: { in: sourceIds } } }),
      db.rawRow.count({ where: { sourceId: { in: sourceIds } } }),
      db.card.count({ where: { sourceId: { in: sourceIds } } }),
      db.shot.count({ where: { card: { sourceId: { in: sourceIds } } } }),
    ])
    out()
    out(
      `Anfragen ${requests} (davon ${retried} wiederholt nach 429/503), Snapshots ${snapshots}, ${Math.round(bytes / 1024)} KiB`
    )
    out(`Ergebnisse: ${[...outcomes].map(([k, v]) => `${k} ${v}`).join(", ")}`)
    out(
      `Antwortzeit: p50 ${percentile(latencies, 50)} ms, p95 ${percentile(latencies, 95)} ms, max ${Math.max(0, ...latencies)} ms`
    )
    out(
      `Rohdaten: ${rawSnapshots} Snapshots, ${rawRows} Zeilen; Scheiben ${cards}, Schusszeilen ${shots}`
    )
    if (memory.length)
      out(
        `Server (${DOCKER ? `Container ${DOCKER}` : "RSS"}): ${Math.min(...memory)}–${Math.max(...memory)} MiB`
      )
  } finally {
    server?.kill()
    if (!KEEP) {
      await db.card.deleteMany({ where: { discipline: { siteId: site.id } } })
      await db.site.delete({ where: { id: site.id } })
      await db.user.delete({ where: { id: user.id } })
    } else out(`behalten: Anlage ${site.id}, Konto ${user.email}`)
    await db.$disconnect()
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
