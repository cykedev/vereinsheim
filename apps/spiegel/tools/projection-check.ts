// Projektionen der Brücke vor und nach einer neuen `PROJECTION_VERSION` vergleichen, gegen die lokale Dev-Datenbank.
// Die gesicherte Datei enthält Werte echter Schützen und gehört nach `reports/` (gitignored, ADR-029); die Ausgabe nennt
// nur Kennungen und Zahlen, nie Werte.
//
//   pnpm --filter spiegel projection-check dump <datei>     Projektionen der Scheiben mit Herkunft Brücke sichern
//   pnpm --filter spiegel projection-check compare <datei>  veraltete nachrechnen und gegen die gesicherten vergleichen

import "dotenv/config"

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { canonicalize } from "@vereinsheim/ingest-contract/canonical"
import { projectionVersion } from "@vereinsheim/shot-core/projection"

import { createPrismaClient, type Db } from "../src/lib/db"
import { refreshStaleProjections } from "../src/lib/db/cards"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { assertDevDatabase } from "./dev-guard"

const out = (text = "") => process.stdout.write(`${text}\n`)

/** die Felder, die gleich bleiben müssen */
const COMPARED = ["probeOnly", "suspicious", "printedShots", "values", "records", "marks"] as const

interface StoredProjection {
  cardId: string
  revisionId: string
  version: string
  probeOnly: boolean
  suspicious: boolean
  printedShots: number
  values: unknown
  records: unknown
  marks: unknown
}

async function rawProjections(db: Db): Promise<StoredProjection[]> {
  const rows = await db.cardProjection.findMany({
    where: { card: { origin: "raw" } },
    select: {
      cardId: true,
      revisionId: true,
      version: true,
      probeOnly: true,
      suspicious: true,
      printedShots: true,
      values: true,
      records: true,
      marks: true,
    },
    orderBy: { cardId: "asc" },
  })
  return rows.map((row) => ({ ...row, revisionId: row.revisionId.toString() }))
}

async function dump(db: Db, file: string) {
  const rows = await rawProjections(db)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(rows))
  out(`${rows.length} Projektionen gesichert`)
}

async function compare(db: Db, file: string): Promise<boolean> {
  const before = JSON.parse(readFileSync(file, "utf8")) as StoredProjection[]
  await refreshStaleProjections(db, {
    onFailure: (cardId, error) =>
      out(`${cardId}: nicht gerechnet (${error instanceof Error ? error.name : "unbekannt"})`),
  })
  const now = new Map((await rawProjections(db)).map((row) => [row.cardId, row]))
  const version = projectionVersion()
  let same = 0
  let missing = 0
  const differing: string[] = []
  for (const old of before) {
    const row = now.get(old.cardId)
    if (!row) {
      missing++
      continue
    }
    const keys = COMPARED.filter((key) => canonicalize(old[key]) !== canonicalize(row[key]))
    if (keys.length) differing.push(`${old.cardId}: ${keys.join(",")}`)
    else same++
  }
  const oldVersion = [...now.values()].filter((row) => row.version !== version).length
  out(
    `gleich: ${same}, abweichend: ${differing.length}, fehlt: ${missing}, alte Version: ${oldVersion}`
  )
  for (const line of differing) out(line)
  return differing.length === 0 && missing === 0 && oldVersion === 0
}

async function main() {
  const args = process.argv.slice(2)
  const [command, file] = args.filter((arg) => !arg.startsWith("--"))
  if ((command !== "dump" && command !== "compare") || !file)
    throw new Error("Aufruf: projection-check dump|compare <datei> [--force]")
  assertDevDatabase(process.env.DATABASE_URL ?? DEV_DATABASE_URL, args.includes("--force"))
  const db = createPrismaClient(process.env.DATABASE_URL ?? DEV_DATABASE_URL)
  try {
    if (command === "dump") await dump(db, file)
    else if (!(await compare(db, file))) process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

void main().catch((error: unknown) => {
  // nur eigene Meldungen im Wortlaut: die von Prisma können Werte enthalten
  out(
    error instanceof Error ? (error.constructor === Error ? error.message : error.name) : "Fehler"
  )
  process.exitCode = 1
})
