// Der gemeinsame Kern der Übernahme für Dev (`tools/transfer.ts`) und den Container des Betriebs
// (`tools/transfer-ops.ts`): Aufruf, Lauf, Ausgabe, Bericht und Exit-Code. Woher Konto und Dateien kommen und wohin der
// Bericht geht, bestimmt der Einstieg (`TransferCliSetup`).
//
// Exit-Codes: 0 fertig ohne Befund, 1 Befund im Prüfbestand, 2 Aufruf falsch, 3 Abbruch der Vorprüfung, 4 Fehler (nichts
// geschrieben: die Transaktion rollt zurück; wirft der Kern, setzt der Einstieg 4), 5 gespeichert, aber Ausgabe, Bericht
// oder die Datei `saved` nicht geschrieben.

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { createPrismaClient } from "../../src/lib/db"
import { runTransfer, type AttachmentFiles } from "../../src/parts/transfer/run"
import type { TreffsicherSource } from "../../src/parts/transfer/source"
import { accountHash } from "./account-hash"
import { argsOf, type TransferArgs } from "./args"
import { abortText, reportMarkdown, summaryLines } from "./report"

export interface TransferCliSetup {
  /** der Aufruf für die Meldung bei Exit 2 */
  call: string
  source: TreffsicherSource
  /** die Dateien der Anhänge; wirft bei einem falschen Aufruf (Exit 2, die Meldung des Fehlers) */
  files(args: TransferArgs): Promise<AttachmentFiles | null>
  databaseUrl: string
  /** der Ordner für den Bericht */
  reportDir: string
  /**
   * nach einem echten, gespeicherten Lauf zuerst diese leere Datei: `vereinsheim transfer` setzt das Merkmal in
   * Treffsicher nur, wenn es sie gibt; null in Dev (dort setzt die Quelle das Merkmal)
   */
  savedFile: string | null
  /** am Ende die Spitze des Speichers ausgeben (im Container gemessen) */
  memoryLine: boolean
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

export async function transferCli(
  argv: readonly string[],
  setup: TransferCliSetup
): Promise<number> {
  const args = argsOf(argv)
  if (!args) {
    process.stderr.write(`${setup.call}\n`)
    return 2
  }
  let files: AttachmentFiles | null
  try {
    files = await setup.files(args)
  } catch (error) {
    process.stderr.write(`${messageOf(error)}\n`)
    return 2
  }
  const db = createPrismaClient(setup.databaseUrl)
  try {
    const startedAt = new Date()
    const outcome = await runTransfer(db, {
      source: setup.source,
      from: args.from,
      to: args.to,
      dryRun: args.dryRun,
      files,
      families: args.families,
      disciplines: args.disciplines,
    })
    if (outcome.kind === "aborted") {
      process.stderr.write(`${abortText(outcome.abort)}\n`)
      return 3
    }
    const { report } = outcome
    // ab hier ist gespeichert (oder der Probelauf fertig): ein Fehler beim Schreiben ist kein Exit 4
    try {
      if (setup.savedFile && !args.dryRun) writeFileSync(setup.savedFile, "")
      process.stdout.write(`${summaryLines(report).join("\n")}\n`)
      mkdirSync(setup.reportDir, { recursive: true })
      const mode = args.dryRun ? "-probe" : ""
      // mit der Uhrzeit (UTC): ein zweiter Lauf am selben Tag überschreibt den Bericht des ersten nicht
      const at = startedAt.toISOString().slice(0, 19).replace(/:/g, "-")
      const file = join(setup.reportDir, `transfer-${at}-${accountHash(args.from)}${mode}.md`)
      writeFileSync(file, `${reportMarkdown(report, startedAt)}\n`)
      process.stdout.write(`Bericht: ${file}\n`)
      return report.check.findings ? 1 : 0
    } catch (error) {
      process.stderr.write(
        `Übernahme ${args.dryRun ? "geprüft" : "gespeichert"} (Prüfbestand: ${report.check.findings ? `${report.check.findings} Befunde` : "ohne Befund"}), aber Ausgabe oder Bericht fehlt: ${messageOf(error)}\n`
      )
      return 5
    }
  } finally {
    await db.$disconnect()
    // `maxRSS` in KiB; der Leser der Ausdrucke läuft als Kindprozess und misst sich selbst
    if (setup.memoryLine)
      process.stdout.write(
        `Speicher: Spitze ${Math.round(process.resourceUsage().maxRSS / 1024)} MiB\n`
      )
  }
}
