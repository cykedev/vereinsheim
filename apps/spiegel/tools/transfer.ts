// Übernahme eines Kontos aus Treffsicher in Spiegel ([[spiegel-account-transfer]], [[adr-033]] Stufe 3), nur gegen die
// lokale Dev-Datenbank. Liest das Konto über `psql` im Dev-Container (ADR-002), schreibt über `runTransfer`
// (`src/parts/transfer/run.ts`). Ausgabe nur mit Zahlen, Gründen und Namen von Disziplinen; der Bericht mit Texten nach
// `reports/tis-3a/` (gitignored), nie mit E-Mail oder Passwort. E-Mails nur auf der Kommandozeile. Den Betrieb auf dem
// VPS übernimmt `vereinsheim transfer` mit `tools/transfer-ops.ts`.
//
//   pnpm --filter spiegel transfer --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>
//     [--dry-run] [--files <Ordner unter tools/private/>] [--family "<Name>=<Kennung der Familie>"]…
//     [--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"]…
//
// Exit-Codes wie `transferCli` (`tools/transfer/cli.ts`): 0 bis 5.

import "dotenv/config"

import { join } from "node:path"

import { DEV_DATABASE_URL } from "../test/dev-database"
import { assertDevDatabase } from "./dev-guard"
import { transferCli } from "./transfer/cli"
import { filesUnder } from "./transfer/files"
import { devTreffsicherSource } from "./transfer/source-dev"

const ROOT = join(__dirname, "../../..")
const CALL = [
  "Aufruf:",
  "  pnpm --filter spiegel transfer --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>",
  '    [--dry-run] [--files <Ordner unter tools/private/>] [--family "<Name>=<Kennung der Familie>"]…',
  '    [--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"]…',
].join("\n")

async function main() {
  const url = process.env.DATABASE_URL ?? DEV_DATABASE_URL
  assertDevDatabase(url, false)
  process.exitCode = await transferCli(process.argv.slice(2), {
    call: CALL,
    source: devTreffsicherSource,
    files: (args) =>
      args.files ? filesUnder(args.files, join(__dirname, "private")) : Promise.resolve(null),
    databaseUrl: url,
    reportDir: join(ROOT, "reports/tis-3a"),
    savedFile: null,
    memoryLine: false,
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 4
})
