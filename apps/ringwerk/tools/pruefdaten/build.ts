// Prüfbestand für Ringwerk: frische Prüfdatenbank anlegen und migrieren.
//
//   pnpm --filter ringwerk pruefdaten --nur-datenbank   nur die leere, migrierte Prüfdatenbank

import path from "node:path"

import { config } from "dotenv"

import { migratePruefDatabase, pruefDatabaseUrl, recreatePruefDatabase } from "./db"

const out = (text = "") => process.stdout.write(`${text}\n`)

/** Liest `apps/ringwerk/.env` in ein eigenes Objekt; `process.env` bleibt unberührt (dort steht die Dev-Datenbank). */
function readAppEnv(): Record<string, string | undefined> {
  const env: Record<string, string> = {}
  config({ path: path.resolve(__dirname, "../../.env"), processEnv: env, quiet: true })
  return { ...env, PRUEF_DATABASE_URL: process.env.PRUEF_DATABASE_URL ?? env.PRUEF_DATABASE_URL }
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("pruefdaten nur in der Entwicklung")
  const args = process.argv.slice(2)
  const appEnv = readAppEnv()
  const url = pruefDatabaseUrl(appEnv)

  await recreatePruefDatabase(url)
  const migrations = await migratePruefDatabase(url)
  out(`Prüfdatenbank ${new URL(url).pathname.slice(1)} neu angelegt, ${migrations} Migrationen`)
  if (args.includes("--nur-datenbank")) return
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
