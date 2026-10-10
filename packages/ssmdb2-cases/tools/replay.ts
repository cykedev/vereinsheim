// Spielt die eingefrorenen Fälle in eine echte MariaDB ein und liest nach jedem Schritt wie die Brücke:
//   pnpm --filter @vereinsheim/ssmdb2-cases replay
// Startet `mariadb:11` (Docker) mit `schema/ssmdb2.sql`, vergleicht die Spaltentypen aus `information_schema` mit
// `src/schema.ts`, spielt je Fall die Schritte `steps/NN.sql` ein und liest danach jede Scheibe in einer lesenden
// Transaktion (`SELECT *` nach Primärschlüssel, Zellen als Text). Die Prüfsumme muss die des eingefrorenen Snapshots
// sein. Nicht im `pnpm check` (braucht Docker, rund eine Minute). Bild: REPLAY_DOCKER_IMAGE (Standard mariadb:11).

import { execFileSync, spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotDataV1, SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"

import { COLUMNS, PRIMARY_KEYS, TABLES, type Table } from "../src/schema"
import { CASES_DIR } from "../src/freeze"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const IMAGE = process.env.REPLAY_DOCKER_IMAGE ?? "mariadb:11"
const CONTAINER = `ssmdb2-cases-${process.pid}`

/** SQL an die Datenbank (Text auf stdin), Ausgabe im Batch-Format ohne Kopf und ohne Escapes */
function sql(input: string, database = "SSMDB2"): string {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "mariadb",
      "--skip-ssl",
      "-uroot",
      "-proot",
      "--default-character-set=utf8mb4",
      "-B",
      "-N",
      "--raw",
      database,
    ],
    { input, encoding: "utf8" }
  )
  if (result.status !== 0)
    throw new Error(`SQL fehlgeschlagen: ${result.stderr}\n${input.slice(0, 500)}`)
  return result.stdout
}

function start() {
  execFileSync("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    CONTAINER,
    "-e",
    "MARIADB_ROOT_PASSWORD=root",
    IMAGE,
    "--skip-ssl",
  ])
  for (let i = 0; i < 60; i++) {
    const probe = spawnSync("docker", [
      "exec",
      CONTAINER,
      "mariadb",
      "--skip-ssl",
      "-uroot",
      "-proot",
      "-e",
      "SELECT 1",
    ])
    if (probe.status === 0) break
    execFileSync("sleep", ["1"])
  }
  sql("CREATE DATABASE SSMDB2;", "mysql")
  sql(readFileSync(join(root, "schema/ssmdb2.sql"), "utf8"))
}

function stop() {
  spawnSync("docker", ["rm", "-f", CONTAINER])
}

/** die Spaltentypen der Datenbank gegen `src/schema.ts` */
function checkColumns(): string[] {
  const rows = sql(
    "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'SSMDB2' ORDER BY TABLE_NAME, ORDINAL_POSITION;"
  )
    .trim()
    .split("\n")
    .map((line) => line.split("\t"))
  const problems: string[] = []
  for (const table of TABLES) {
    const inDb = rows.filter(([t]) => t === table).map(([, column, type]) => [column, type])
    if (JSON.stringify(inDb) !== JSON.stringify(Object.entries(COLUMNS[table])))
      problems.push(`${table}: Spalten in der Datenbank weichen von src/schema.ts ab`)
  }
  return problems
}

/** eine Scheibe lesen wie die Brücke: in einer lesenden Transaktion, jede Tabelle nach Primärschlüssel */
function readCard(scheibenId: number): SnapshotDataV1 {
  const select = (table: Table) =>
    `SELECT '@${table}'; SELECT * FROM \`${table}\` WHERE ScheibenID = ${scheibenId} ORDER BY ${PRIMARY_KEYS[
      table
    ]
      .map((k) => `\`${k}\``)
      .join(", ")};`
  const out = sql(
    `START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;\n${TABLES.map(select).join("\n")}\nCOMMIT;\n`
  )
  const rows: Record<Table, Record<string, string>[]> = { Scheiben: [], Serien: [], Treffer: [] }
  let current: Table | null = null
  for (const line of out.split("\n")) {
    if (!line) continue
    if (line.startsWith("@")) {
      current = line.slice(1) as Table
      continue
    }
    const cells = line.split("\t")
    const columns = Object.keys(COLUMNS[current!])
    rows[current!].push(Object.fromEntries(columns.map((c, i) => [c, cells[i]])))
  }
  const table = (name: Table) => ({ columns: { ...COLUMNS[name] }, rows: rows[name] })
  return { scheiben: table("Scheiben"), serien: table("Serien"), treffer: table("Treffer") }
}

interface FrozenReading {
  reading: number
  snapshots: SnapshotV1[]
}

function replayCase(id: string): string[] {
  const dir = join(root, CASES_DIR, id)
  const readings: FrozenReading[] = JSON.parse(readFileSync(join(dir, "snapshots.json"), "utf8"))
  const steps = readdirSync(join(dir, "steps")).sort()
  const problems: string[] = []
  sql("DELETE FROM Scheiben; DELETE FROM Version;")
  steps.forEach((step, i) => {
    sql(readFileSync(join(dir, "steps", step), "utf8"))
    const reading = readings[i]
    const inDb = sql("SELECT ScheibenID FROM Scheiben ORDER BY ScheibenID;")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number)
    const frozenIds = reading.snapshots.map((s) => s.scheibenId)
    if (JSON.stringify(inDb) !== JSON.stringify(frozenIds))
      problems.push(`${id} Lesung ${reading.reading}: Scheiben ${inDb} statt ${frozenIds}`)
    const version = sql("SELECT Versionsnummer FROM Version;").trim()
    for (const snapshot of reading.snapshots) {
      if (version !== snapshot.sourceVersion)
        problems.push(`${id} Lesung ${reading.reading}: Version ${version}`)
      const read = readCard(snapshot.scheibenId)
      if (computeChecksum(read) !== snapshot.checksum)
        problems.push(
          `${id} Lesung ${reading.reading}, Scheibe ${snapshot.scheibenId}: Prüfsumme weicht ab (Treffer ${read.treffer.rows.length} statt ${snapshot.data.treffer.rows.length})`
        )
    }
  })
  return problems
}

process.on("exit", stop)
process.on("SIGINT", () => process.exit(130))
start()
const problems = checkColumns()
const ids = readdirSync(join(root, CASES_DIR)).sort()
let steps = 0
for (const id of ids) {
  const found = replayCase(id)
  steps += readdirSync(join(root, CASES_DIR, id, "steps")).length
  console.log(`${found.length ? "FEHLER" : "ok    "} ${id}`)
  problems.push(...found)
}
if (problems.length) {
  console.error(problems.join("\n"))
  process.exit(1)
}
console.log(
  `${ids.length} Fälle, ${steps} Schritte: jede Lesung wie eingefroren, Spalten wie src/schema.ts`
)
