// Einen Ordner alter Meyton-Ausdrucke (PDF) in Scheiben eines Kontos einlesen ([[meyton-printout]] „Alte Ausdrucke
// einlesen“): je PDF derselbe Weg wie ein Upload unter „Scheibe holen“ (Kindprozess, Datei nach sha256 unter
// `UPLOAD_DIR`), dann `importPrintout` ohne Auftrag an die Brücke. Idempotent: Eine Datei, die schon an einer eigenen
// Scheibe hängt, liest es nicht noch einmal. Der Bericht enthält nur Zahlen (ADR-029): keinen Namen, keine ID, kein
// Datum, keinen Dateinamen. Nur gegen die lokale Dev-Datenbank (`--force` für eine andere lokale); den Weg in Prod
// beschreibt der Vault.
//
//   pnpm --filter spiegel printout-import <ordner> [--email <adresse>] [--dry-run] [--force]

import "dotenv/config"

import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { requestSiteId } from "../src/lib/card-requests/queries"
import { createPrismaClient } from "../src/lib/db"
import { importPrintout } from "../src/lib/fetch-card/import"
import { storePrintout } from "../src/lib/printouts/store"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { assertDevDatabase } from "./dev-guard"

const CALL = "Aufruf: pnpm --filter spiegel printout-import <ordner> --email <adresse> [--dry-run]"

function argsOf(argv: readonly string[]) {
  const folder = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--email")
  if (!folder) throw new Error(`Ordner mit PDFs angeben.\n${CALL}`)
  const emailAt = argv.indexOf("--email")
  const email = emailAt === -1 ? (process.env.SEED_ADMIN_EMAIL ?? "") : (argv[emailAt + 1] ?? "")
  if (email === "" || email.startsWith("--"))
    throw new Error(
      `printout-import braucht ein Konto: --email <adresse> oder SEED_ADMIN_EMAIL in apps/spiegel/.env.\n${CALL}`
    )
  return { folder, email, dryRun: argv.includes("--dry-run"), force: argv.includes("--force") }
}

/** zählt Ergebnisse unter festen Namen */
class Counts {
  private readonly map = new Map<string, number>()
  add(key: string) {
    this.map.set(key, (this.map.get(key) ?? 0) + 1)
  }
  lines(): string[] {
    return [...this.map].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `  ${k}: ${n}`)
  }
}

async function main() {
  const { folder, email, dryRun, force } = argsOf(process.argv.slice(2))
  const url = process.env.DATABASE_URL ?? DEV_DATABASE_URL
  assertDevDatabase(url, force)
  const db = createPrismaClient(url)
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (!user) throw new Error(`Konto nicht gefunden (--email oder SEED_ADMIN_EMAIL).\n${CALL}`)
    const siteId = await requestSiteId(db)
    if (siteId === null) throw new Error("Keine Anlage in der Datenbank.")
    const { timeZone } = await db.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { timeZone: true },
    })

    const files = readdirSync(folder)
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .sort()
    const outcome = new Counts()
    const withoutValues = new Counts()
    const rejected = new Counts()
    let withValues = 0
    let maxRssKb = 0
    for (const name of files) {
      const bytes = new Uint8Array(readFileSync(join(folder, name)))
      const sha256 = createHash("sha256").update(bytes).digest("hex")
      const there = await db.printout.findFirst({
        where: { sha256, card: { is: { ownerId: user.id } } },
        select: { id: true },
      })
      if (there) {
        outcome.add("schon da")
        continue
      }
      const stored = await storePrintout({ bytes, timeZone, fileName: name }, { write: !dryRun })
      if (stored.kind === "rejected") {
        rejected.add(stored.reason)
        continue
      }
      maxRssKb = Math.max(maxRssKb, stored.maxRssKb)
      const result = await importPrintout(db, {
        userId: user.id,
        siteId,
        file: stored.file,
        dryRun,
      })
      const labels: Record<typeof result.kind, string> = {
        attached: "angehängt",
        created: "angelegt",
        trashed: "im Papierkorb",
        taken: "fremd",
        blocked: "gesperrt",
        noDiscipline: "ohne Disziplin",
      }
      outcome.add(labels[result.kind])
      if (result.kind === "attached" || result.kind === "created") {
        if (result.values) withValues++
        else
          withoutValues.add(
            stored.file.values.status === "ok" ? "inconsistent" : stored.file.values.status
          )
      }
    }

    const out = [
      `${dryRun ? "Probelauf, nichts geschrieben. " : ""}${files.length} PDFs im Ordner`,
      "Ergebnis:",
      ...outcome.lines(),
      `mit Werten: ${withValues}`,
      "ohne Werte je Status:",
      ...withoutValues.lines(),
      "abgelehnt je Grund:",
      ...rejected.lines(),
      `größter Speicher des Lesers: ${maxRssKb} KB`,
    ]
    process.stdout.write(`${out.join("\n")}\n`)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
