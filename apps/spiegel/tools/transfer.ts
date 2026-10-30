// Übernahme eines Kontos aus Treffsicher in Spiegel ([[spiegel-account-transfer]], [[adr-033]] Stufe 3), nur gegen die
// lokale Dev-Datenbank. Liest das Konto über `psql` im Dev-Container (ADR-002), schreibt über `runTransfer`
// (`src/parts/transfer/run.ts`). Ausgabe nur mit Zahlen, Gründen und Namen von Disziplinen; der Bericht mit Texten nach
// `reports/tis-3a/` (gitignored), nie mit E-Mail oder Passwort. E-Mails nur auf der Kommandozeile.
//
//   pnpm --filter spiegel transfer --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>
//     [--dry-run] [--files <Ordner unter tools/private/>] [--family "<Name>=<Kennung der Familie>"]…
//     [--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"]…
//
// Exit-Codes: 0 fertig ohne Befund, 1 Befund im Prüfbestand, 2 Aufruf falsch, 3 Abbruch der Vorprüfung, 4 Fehler (nichts
// geschrieben: die Transaktion rollt zurück), 5 gespeichert, aber Ausgabe oder Bericht nicht geschrieben.

import "dotenv/config"

import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { createPrismaClient } from "../src/lib/db"
import { runTransfer } from "../src/parts/transfer/run"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { assertDevDatabase } from "./dev-guard"
import { argsOf } from "./transfer/args"
import { filesUnder } from "./transfer/files"
import { abortText, reportMarkdown, summaryLines } from "./transfer/report"
import { devTreffsicherSource } from "./transfer/source-dev"

const ROOT = join(__dirname, "../../..")
const CALL = [
  "Aufruf:",
  "  pnpm --filter spiegel transfer --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>",
  '    [--dry-run] [--files <Ordner unter tools/private/>] [--family "<Name>=<Kennung der Familie>"]…',
  '    [--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"]…',
].join("\n")

async function main() {
  const args = argsOf(process.argv.slice(2))
  if (!args) {
    process.stderr.write(`${CALL}\n`)
    process.exitCode = 2
    return
  }
  let files = null
  if (args.files) {
    try {
      files = await filesUnder(args.files, join(__dirname, "private"))
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 2
      return
    }
  }
  const url = process.env.DATABASE_URL ?? DEV_DATABASE_URL
  assertDevDatabase(url, false)
  const db = createPrismaClient(url)
  try {
    const startedAt = new Date()
    const outcome = await runTransfer(db, {
      source: devTreffsicherSource,
      from: args.from,
      to: args.to,
      dryRun: args.dryRun,
      files,
      families: args.families,
      disciplines: args.disciplines,
    })
    if (outcome.kind === "aborted") {
      process.stderr.write(`${abortText(outcome.abort)}\n`)
      process.exitCode = 3
      return
    }
    const { report } = outcome
    // ab hier ist gespeichert (oder der Probelauf fertig): ein Fehler beim Schreiben der Ausgabe ist kein Exit 4
    try {
      process.stdout.write(`${summaryLines(report).join("\n")}\n`)
      const dir = join(ROOT, "reports/tis-3a")
      mkdirSync(dir, { recursive: true })
      const who = createHash("sha256")
        .update(args.from.trim().toLowerCase())
        .digest("hex")
        .slice(0, 8)
      const mode = args.dryRun ? "-probe" : ""
      const file = join(dir, `transfer-${startedAt.toISOString().slice(0, 10)}-${who}${mode}.md`)
      writeFileSync(file, `${reportMarkdown(report, startedAt)}\n`)
      process.stdout.write(`Bericht: ${file}\n`)
      process.exitCode = report.check.findings ? 1 : 0
    } catch (error) {
      process.stderr.write(
        `Übernahme ${args.dryRun ? "geprüft" : "gespeichert"}, aber der Bericht fehlt: ${error instanceof Error ? error.message : String(error)}\n`
      )
      process.exitCode = 5
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 4
})
