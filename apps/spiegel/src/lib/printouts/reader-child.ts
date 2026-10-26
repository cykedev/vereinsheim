// Kindprozess, der einen fremden Ausdruck liest (SF-48). Die App startet ihn je PDF neu, mit eigener Speichergrenze,
// und beendet ihn hart nach der Zeitgrenze (`reader.ts`). Ablauf: bereit melden, die Bytes von stdin lesen, eine Zeile
// JSON nach `ChildResult` schreiben. In Produktion läuft er als Bündel `printout-reader.mjs` (`tools/build-reader.ts`),
// deshalb nur relative Imports und Pakete, kein `@/`.

import { writeFileSync } from "node:fs"

import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"

import { READY_LINE, type ChildResult } from "./protocol"

/** liest stdin ganz, aber höchstens `limit` Bytes; den Rest verwirft es */
async function readStdin(limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    if (total >= limit) continue
    const part = chunk.subarray(0, limit - total)
    chunks.push(part)
    total += part.length
  }
  return new Uint8Array(Buffer.concat(chunks, total))
}

function maxParseMsOf(argv: readonly string[]): number {
  const arg = argv.find((value) => value.startsWith("--max-parse-ms="))
  const value = Number(arg?.slice("--max-parse-ms=".length))
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LIMITS.maxParseMs
}

function reply(result: ChildResult) {
  process.stdout.write(JSON.stringify(result) + "\n")
}

async function main() {
  // Bei Knappheit im Container trifft der Kernel den Kindprozess, nicht die App (nur Linux).
  try {
    writeFileSync("/proc/self/oom_score_adj", "1000")
  } catch {
    // außerhalb von Linux gibt es die Datei nicht
  }
  // erst jetzt pdf.js laden: der Schritt oben steht davor
  const { MeytonPdfError, preloadPdfjs, readPrintout } =
    await import("@vereinsheim/meyton-pdf/printout")
  await preloadPdfjs()
  process.stdout.write(READY_LINE + "\n")

  const bytes = await readStdin(DEFAULT_LIMITS.maxBytes + 1)
  const maxParseMs = maxParseMsOf(process.argv)
  try {
    const printout = await readPrintout(bytes, { limits: { maxParseMs } })
    reply({
      ok: true,
      pages: printout.pages,
      id: printout.id,
      createdAt: printout.createdAt,
      maxRssKb: process.resourceUsage().maxRSS,
    })
  } catch (error) {
    // jeder andere Fehler fällt durch: Exit ≠ 0 gilt der App als abgestürzt
    if (!(error instanceof MeytonPdfError)) throw error
    reply({ ok: false, code: error.code, maxRssKb: process.resourceUsage().maxRSS })
  }
  process.exitCode = 0
}

main().catch(() => {
  process.exitCode = 1
})
