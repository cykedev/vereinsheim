// Prüfdatenbank für Ringwerk: eine eigene Datenbank im Dev-Postgres (`ringwerk_pruef`), nie die Dev-Datenbank mit der
// Kopie der echten Daten. Jeder Lauf beginnt mit einer frischen Datenbank: löschen, neu anlegen (Owner ist die Rolle aus
// der URL, wie bei der Dev-Datenbank), Migrationen mit `prisma migrate deploy`.
//
// Schutz: Jede Funktion prüft die URL zuerst. Sie muss auf diesen Rechner zeigen, und der Name der Datenbank muss auf
// `_pruef` enden. Sonst bricht sie ab, bevor eine Verbindung entsteht.

import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"

import { Client } from "pg"

export const PRUEF_DATABASE_NAME = "ringwerk_pruef"

const DEFAULT_PRUEF_DATABASE_URL = `postgresql://ringwerk:ringwerk@localhost:5432/${PRUEF_DATABASE_NAME}`
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"]
const APP_DIR = path.resolve(__dirname, "../..")

/** Name der Datenbank aus der URL, wenn sie lokal ist und auf `_pruef` endet; sonst ein Fehler. */
export function assertPruefDatabaseUrl(url: string): string {
  const parsed = new URL(url)
  if (!LOCAL_HOSTS.includes(parsed.hostname)) {
    throw new Error(`Prüfdatenbank nur auf diesem Rechner, nicht auf ${parsed.hostname}`)
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  if (!/^[a-z0-9_]+_pruef$/.test(name)) {
    throw new Error(`Prüfdatenbank muss auf _pruef enden, nicht „${name}“`)
  }
  return name
}

/** URL der Prüfdatenbank: `PRUEF_DATABASE_URL` aus der Umgebung oder die lokale Voreinstellung, immer geprüft. */
export function pruefDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.PRUEF_DATABASE_URL || DEFAULT_PRUEF_DATABASE_URL
  assertPruefDatabaseUrl(url)
  return url
}

/** Löscht die Prüfdatenbank (auch mit offenen Verbindungen) und legt sie leer neu an. */
export async function recreatePruefDatabase(url: string): Promise<void> {
  const name = assertPruefDatabaseUrl(url)
  const maintenance = new URL(url)
  maintenance.pathname = "/postgres"
  const client = new Client({ connectionString: maintenance.toString() })
  await client.connect()
  try {
    // Der Name ist oben auf [a-z0-9_]+_pruef geprüft und darf deshalb in den Bezeichner.
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    await client.query(`CREATE DATABASE "${name}"`)
    await client.query(`REVOKE ALL ON DATABASE "${name}" FROM PUBLIC`)
  } finally {
    await client.end()
  }
}

/** Wendet alle Migrationen an und prüft, dass jede durchgelaufen ist. */
export async function migratePruefDatabase(url: string): Promise<number> {
  assertPruefDatabaseUrl(url)
  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: APP_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy fehlgeschlagen:\n${result.stdout}\n${result.stderr}`)
  }

  const expected = readdirSync(path.join(APP_DIR, "prisma/migrations"), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory()).length
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<{ done: string }>(
      `SELECT count(*) AS done FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    )
    const done = Number(rows[0].done)
    if (done !== expected) {
      throw new Error(`Migrationen: ${done} von ${expected} angewendet`)
    }
    return done
  } finally {
    await client.end()
  }
}
