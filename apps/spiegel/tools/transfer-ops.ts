// Übernahme eines Kontos aus Treffsicher im Container des Betriebs ([[spiegel-account-transfer]], Abschnitt „Betrieb“):
// gebündelt als `transfer.mjs` (`tools/build-transfer.ts`), gestartet nur von `vereinsheim transfer` über den Dienst
// `transfer-spiegel` (`compose.yml`). Das Konto kommt per Pipe auf stdin (Export aus `treffsicher-account.sql`, leer:
// kein Konto), die Besitzer aus `$TRANSFER_DIR/owners.txt`, die Dateien der Anhänge aus `$TRANSFER_FILES` (Volume von
// Treffsicher, nur lesend). Bericht und die Datei `saved` gehen nach `$TRANSFER_DIR`; das Merkmal in Treffsicher setzt
// `vereinsheim transfer` danach auf dem Host. E-Mails nur auf der Kommandozeile.
//
// Exit-Codes wie `transferCli` (`tools/transfer/cli.ts`): 0 bis 5.

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { argsOf } from "./transfer/args"
import { transferCli } from "./transfer/cli"
import { filesIn } from "./transfer/files"
import { exportTreffsicherSource } from "./transfer/source-export"

const CALL = [
  "Aufruf (nur über vereinsheim transfer):",
  "  node transfer.mjs --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel> [--dry-run]",
  '    [--family "<Name>=<Kennung der Familie>"]… [--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"]…',
  "  Konto auf stdin; Umgebung: DATABASE_URL, TRANSFER_DIR (mit owners.txt), TRANSFER_FILES",
].join("\n")

const ENV = ["DATABASE_URL", "TRANSFER_DIR", "TRANSFER_FILES"] as const

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

async function main() {
  const argv = process.argv.slice(2)
  // vor stdin: ein falscher Aufruf soll nicht auf eine Pipe warten
  const args = argsOf(argv)
  if (!args) {
    process.stderr.write(`${CALL}\n`)
    process.exitCode = 2
    return
  }
  if (args.files) {
    process.stderr.write(
      "--files gibt es nur in Dev; im Container kommen die Dateien aus dem Volume\n"
    )
    process.exitCode = 2
    return
  }
  const missing = ENV.filter((name) => !process.env[name])
  if (missing.length) {
    process.stderr.write(`Umgebung fehlt: ${missing.join(", ")}\n`)
    process.exitCode = 2
    return
  }
  const dir = process.env.TRANSFER_DIR!
  const source = exportTreffsicherSource({
    owners: await readFile(join(dir, "owners.txt"), "utf8"),
    account: await readStdin(),
  })
  process.exitCode = await transferCli(argv, {
    call: CALL,
    source,
    files: () => filesIn(process.env.TRANSFER_FILES!),
    databaseUrl: process.env.DATABASE_URL!,
    reportDir: dir,
    savedFile: join(dir, "saved"),
    memoryLine: true,
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 4
})
