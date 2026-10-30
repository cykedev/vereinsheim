// Die geprüfte Zuordnungsdatei für `vereinsheim transfer --mapping` und `transfer status` auf dem Mac
// ([[spiegel-account-transfer]], Abschnitt „Betrieb“). Die Datei bleibt auf dem Mac; nach außen gehen nur Zeilen und
// Hashes, die E-Mails nur auf stdout von `plan` an das CLI, das sie je Zeile auf die Kommandozeile setzt.
//
//   tsx tools/transfer-mapping.ts plan <datei>
//     stdout je Zeile, die läuft: <Zeile>\t<from>\t<to>\t<Hash>; stderr die abgelehnten Zeilen
//     Exit 0, 2 Format oder Aufruf falsch, 3 Widerspruch in der Datei (nichts läuft)
//   tsx tools/transfer-mapping.ts status <datei> <treffsicher-status.txt> <spiegel-status.txt>
//     je Zeile Zustand und Summen, aus der Ausgabe von `treffsicher-status.sql` und `spiegel-status.sql`

import { readFileSync } from "node:fs"

import { parseMappingCsvLines } from "../src/lib/transfer/accountMatch"
import {
  outsideMapping,
  parseSpiegelStatus,
  parseTreffsicherStatus,
  planMapping,
  statusRows,
  type MappingLine,
  type MappingState,
  type RejectReason,
} from "./transfer/mapping"
import { accountHash } from "./transfer/account-hash"

const CALL = [
  "Aufruf:",
  "  tsx tools/transfer-mapping.ts plan <Zuordnungsdatei>",
  "  tsx tools/transfer-mapping.ts status <Zuordnungsdatei> <Status Treffsicher> <Status Spiegel>",
].join("\n")

const REASONS: Record<RejectReason, string> = {
  check: "Verdacht, noch nicht entschieden (check)",
  checkPending: "zu diesem Konto steht noch eine Zeile check",
}

const STATES: readonly MappingState[] = [
  "übernommen",
  "Merkmal fehlt",
  "Merkmal ohne Lauf",
  "offen",
  "zu prüfen",
  "fehlt in Treffsicher",
]

/** die Datei; ein Formatfehler nennt nur die Zeile (Exit 2) */
function mappingOf(file: string): MappingLine[] | null {
  try {
    return parseMappingCsvLines(readFileSync(file, "utf8"))
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return null
  }
}

function plan(file: string): number {
  const rows = mappingOf(file)
  if (!rows) return 2
  const result = planMapping(rows)
  if (result.kind === "conflict") {
    const byLine = new Map(rows.map((row) => [row.line, row]))
    const group = (lines: number[]) =>
      lines.map((line) => `${line} (${accountHash(byLine.get(line)!.from)})`).join(", ")
    for (const lines of result.fromConflicts)
      process.stderr.write(
        `Ein Konto aus Treffsicher mit mehreren Zielen: Zeilen ${group(lines)}\n`
      )
    for (const lines of result.toConflicts)
      process.stderr.write(`Mehrere Konten aus Treffsicher auf ein Ziel: Zeilen ${group(lines)}\n`)
    process.stderr.write("Nichts läuft: erst die Datei klären.\n")
    return 3
  }
  for (const rejected of result.rejected)
    process.stderr.write(`Zeile ${rejected.line} (${rejected.hash}): ${REASONS[rejected.reason]}\n`)
  for (const run of result.runs)
    process.stdout.write(`${run.line}\t${run.from}\t${run.to}\t${run.hash}\n`)
  return 0
}

function status(file: string, treffsicherFile: string, spiegelFile: string): number {
  const rows = mappingOf(file)
  if (!rows) return 2
  const treffsicher = parseTreffsicherStatus(readFileSync(treffsicherFile, "utf8"))
  const spiegel = parseSpiegelStatus(readFileSync(spiegelFile, "utf8"))
  const lines = statusRows(rows, treffsicher, spiegel)
  for (const row of lines)
    process.stdout.write(`Zeile ${String(row.line).padStart(3)}  ${row.hash}  ${row.state}\n`)
  process.stdout.write("\n")
  for (const state of STATES) {
    const n = lines.filter((row) => row.state === state).length
    if (n) process.stdout.write(`${state}: ${n}\n`)
  }
  process.stdout.write(
    `Konten in Treffsicher, die nicht in der Datei stehen: ${outsideMapping(treffsicher, rows)}\n`
  )
  return 0
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  if (command === "plan" && rest.length === 1) process.exitCode = plan(rest[0])
  else if (command === "status" && rest.length === 3)
    process.exitCode = status(rest[0], rest[1], rest[2])
  else {
    process.stderr.write(`${CALL}\n`)
    process.exitCode = 2
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 4
})
