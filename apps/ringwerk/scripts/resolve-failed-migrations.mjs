import { spawnSync } from "node:child_process"
import process from "node:process"
import pg from "pg"

const { Client } = pg
const PRISMA_CLI_JS = "/app/node_modules/prisma/build/index.js"

function runPrismaResolve(mode, migrationName) {
  const prismaArgs = ["migrate", "resolve", mode, migrationName]
  const result = spawnSync("node", [PRISMA_CLI_JS, ...prismaArgs], {
    stdio: "inherit",
  })

  if (result.error?.code === "ENOENT") {
    throw new Error("Prisma CLI not found at /app/node_modules/prisma/build/index.js.")
  }

  if (result.status === 127) {
    throw new Error("Prisma CLI is not executable in the runtime image.")
  }

  if (result.status !== 0) {
    throw new Error(`prisma migrate resolve failed for ${migrationName} (${mode}).`)
  }
}

function isMissingMigrationsTable(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01"
}

async function loadFailedMigrations(client) {
  try {
    return await client.query(
      `SELECT migration_name, logs
       FROM "_prisma_migrations"
       WHERE finished_at IS NULL
         AND rolled_back_at IS NULL
       ORDER BY started_at ASC`
    )
  } catch (error) {
    // Frische Datenbank: Tabelle existiert noch nicht, also keine failed migrations.
    if (isMissingMigrationsTable(error)) {
      console.warn("[migrate-recovery] _prisma_migrations table not found yet. Skipping recovery.")
      return null
    }
    throw error
  }
}

// Bekannte Recovery-Handler für fehlgeschlagene Migrationen.
// Bei neuen fehlgeschlagenen Migrationen hier einen Handler eintragen.
const KNOWN_RECOVERY_HANDLERS = {
  // Spalte existierte bereits in der DB — Migration als angewandt markieren
  "20260324000000_participant_guest_record": (_client, migrationName) => {
    runPrismaResolve("--applied", migrationName)
  },
  // Idempotente Migration — als zurückgerollt markieren, damit sie sauber neu läuft
  "20260326000000_add_event_teams": (_client, migrationName) => {
    runPrismaResolve("--rolled-back", migrationName)
  },
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for migration recovery.")
  }

  const autoResolveUnknown = process.env.PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS === "true"

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const failedResult = await loadFailedMigrations(client)
    if (!failedResult || failedResult.rowCount === 0) {
      console.warn("[migrate-recovery] No failed migrations detected.")
      return
    }

    let unresolvedCount = 0

    for (const row of failedResult.rows) {
      const migrationName = String(row.migration_name)
      const logs = row.logs ? String(row.logs) : ""
      const handler = KNOWN_RECOVERY_HANDLERS[migrationName]

      if (handler) {
        await handler(client, migrationName)
        continue
      }

      if (autoResolveUnknown) {
        console.warn(
          `[migrate-recovery] No specific handler for ${migrationName}. Marking as rolled back because PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS=true.`
        )
        runPrismaResolve("--rolled-back", migrationName)
        continue
      }

      unresolvedCount += 1
      console.error(
        `[migrate-recovery] No automatic recovery configured for ${migrationName}. Manual intervention required.`
      )
      if (logs) {
        console.error(`[migrate-recovery] Last migration logs for ${migrationName}:`)
        console.error(logs)
      }
    }

    if (unresolvedCount > 0) {
      throw new Error(`${unresolvedCount} failed migration(s) could not be auto-resolved.`)
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("[migrate-recovery] Migration recovery failed.")
  console.error(error)
  process.exit(1)
})
