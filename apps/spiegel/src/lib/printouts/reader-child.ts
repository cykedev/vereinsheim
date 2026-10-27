// Kindprozess, der einen fremden Ausdruck liest (SF-48). Die App startet ihn je PDF neu, mit eigener Speichergrenze,
// und beendet ihn hart nach der Zeitgrenze (`reader.ts`). Ablauf: bereit melden, die Bytes von stdin lesen, eine Zeile
// JSON nach `ChildResult` schreiben (ID und Druckzeit), dann in der restlichen Zeit die Werte lesen und eine zweite Zeile
// schreiben (`ValuesLine`). In Produktion läuft er als Bündel `printout-reader.mjs` (`tools/build-reader.ts`),
// deshalb nur relative Imports und Pakete, kein `@/`.

import { writeFileSync } from "node:fs"

import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"

import {
  PRODUCER_MAX,
  READY_LINE,
  valuesSchema,
  type ChildResult,
  type ValuesLine,
  type ValuesRead,
} from "./protocol"

/** ab dieser Größe der Antwort fallen die Werte weg; die Grenze der App für die ganze Zeile ist 64 KiB */
const VALUES_JSON_MAX = 48 * 1024

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

/**
 * Werte und Lesung des Ausdrucks in der restlichen Zeit; jeder Fehler wird `failed`. Was die Grenzen des Protokolls
 * sprengt, gilt als zu viel.
 */
async function readValues(
  bytes: Uint8Array,
  producer: string | null,
  restMs: number
): Promise<ValuesRead> {
  if (restMs <= 0) return { kind: "failed", code: "timeout" }
  const { MeytonPdfError } = await import("@vereinsheim/meyton-pdf/errors")
  try {
    const { readPrintoutValues } = await import("@vereinsheim/meyton-pdf/values")
    const { printoutReading } = await import("@vereinsheim/meyton-pdf/reading")
    const values = await readPrintoutValues(bytes, { limits: { maxParseMs: restMs } })
    const result = valuesSchema.safeParse(printoutReading(values, { producer }))
    if (!result.success) return { kind: "failed", code: "tooMuchText" }
    if (JSON.stringify(result.data).length > VALUES_JSON_MAX)
      return { kind: "failed", code: "tooMuchText" }
    return result.data
  } catch (error) {
    return { kind: "failed", code: error instanceof MeytonPdfError ? error.code : "unreadable" }
  }
}

function reply(line: ChildResult | ValuesLine) {
  process.stdout.write(JSON.stringify(line) + "\n")
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
  const startedAt = performance.now()
  try {
    const printout = await readPrintout(bytes, { limits: { maxParseMs } })
    const producer = printout.producer?.slice(0, PRODUCER_MAX) ?? null
    // ID und Druckzeit zuerst: Beendet die App den Kindprozess bei den Werten, gelten sie trotzdem
    reply({
      ok: true,
      pages: printout.pages,
      id: printout.id,
      createdAt: printout.createdAt,
      producer,
      maxRssKb: process.resourceUsage().maxRSS,
    })
    const values = await readValues(bytes, producer, maxParseMs - (performance.now() - startedAt))
    reply({ values, maxRssKb: process.resourceUsage().maxRSS })
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
