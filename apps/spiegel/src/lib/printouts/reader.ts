// Liest einen fremden Ausdruck in einem kurzlebigen Kindprozess (SF-48, [[meyton-printout]] „Grenzen“). pdf.js baut
// beim Dekomprimieren, bei XMP und Glyphen Speicher auf, ohne dass eine Grenze dazwischenkommt; im Prozess der App
// brächte ein präpariertes PDF den Server zum Absturz. Der Kindprozess hat deshalb eine eigene Speichergrenze, wird
// nach der Zeitgrenze hart beendet, und es läuft immer nur einer.
//
// Diese Datei importiert nie `@vereinsheim/meyton-pdf/printout`, sonst läge pdf.js im Server.
//
// Speicherbudget im Container (256 MiB): die App unter Last 147 bis 152 MiB, der Kindprozess bis 96 MiB, dann bricht
// die Wache ab. Reicht das einmal nicht, trifft der OOM-Killer den Kindprozess (`oom_score_adj` in `reader-child.ts`).
// `--max-old-space-size` begrenzt keine ArrayBuffer, und pdf.js entpackt in Uint8Arrays: Deshalb liest die App unter
// Linux alle 50 ms `VmRSS` des Kindprozesses. Der Kindprozess läuft mit `--lite-mode`, ohne optimierenden Compiler:
// Schon das Laden von pdf.js bringt ihn sonst nahe an die Grenze, gemessen an echten Ausdrucken. Ein Ausdruck ist klein,
// das Lesen wird dadurch kaum langsamer.

import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { MeytonPdfErrorCode } from "@vereinsheim/meyton-pdf/errors"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"
import type { PdfDate } from "@vereinsheim/meyton-pdf/pdf-date"
import type { PrintoutIdResult } from "@vereinsheim/meyton-pdf/printout-id"

import { childResultSchema, READY_LINE } from "./protocol"

const CHILD_HEAP_MB = 48
/** unter tsx liegt der Lader selbst im Heap */
const DEV_LOADER_HEAP_MB = 32
const CHILD_SEMI_SPACE_MB = 2
export const CHILD_MAX_RSS_MB = 96
const RSS_POLL_MS = 50
const STARTUP_MS = 5_000
const OUTPUT_LIMIT = 64 * 1024
const STDERR_KEEP = 4 * 1024
const MAX_WAITING = 3

/** der gebündelte Kindprozess im Arbeitsverzeichnis der App (`tools/build-reader.ts`) */
export const READER_BUNDLE = "printout-reader.mjs"

export type ReadFailure = "busy" | "timeout" | "memory" | "crashed" | MeytonPdfErrorCode

export type IsolatedRead =
  | {
      kind: "read"
      pages: number
      id: PrintoutIdResult
      createdAt: (PdfDate & { source: "info" | "xmp" }) | null
      maxRssKb: number
    }
  | { kind: "failed"; reason: ReadFailure }

export interface IsolatedReadOptions {
  maxParseMs?: number
  startupMs?: number
  /** anderes Skript als Kindprozess (Tests) */
  script?: string
  /** RSS eines Prozesses in Bytes; null: keine Wache */
  rssOf?: (pid: number) => number | null
}

const heapFlags = (heapMb: number) => [
  `--max-old-space-size=${heapMb}`,
  `--max-semi-space-size=${CHILD_SEMI_SPACE_MB}`,
  // ohne optimierenden Compiler: weniger Speicher für Code (siehe oben)
  "--lite-mode",
]

/** Argumente für `node`: das Skript der Tests, sonst das Bündel, ohne Bündel (Dev, Tests) die Quelle über tsx */
export function readerArgs(script?: string): string[] {
  if (script) return [...heapFlags(CHILD_HEAP_MB), script]
  const bundle = join(process.cwd(), READER_BUNDLE)
  if (existsSync(bundle)) return [...heapFlags(CHILD_HEAP_MB), bundle]
  return [
    ...heapFlags(CHILD_HEAP_MB + DEV_LOADER_HEAP_MB),
    "--import",
    "tsx",
    join(process.cwd(), "src/lib/printouts/reader-child.ts"),
  ]
}

/** nur `NODE_ENV`: kein `NODE_OPTIONS` (sonst gälte der Heap der App) und keine Geheimnisse */
export function childEnv(): NodeJS.ProcessEnv {
  return { NODE_ENV: process.env.NODE_ENV ?? "production" }
}

/** in Produktion fehlt das Bündel im Arbeitsverzeichnis: Ausdrucke lassen sich nicht lesen */
export function readerBundleMissing(): boolean {
  return process.env.NODE_ENV === "production" && !existsSync(join(process.cwd(), READER_BUNDLE))
}

/** `VmRSS` aus `/proc/<pid>/status` in Bytes; außerhalb von Linux null */
function procRss(pid: number): number | null {
  if (process.platform !== "linux") return null
  try {
    const match = /^VmRSS:\s+(\d+)\s+kB/m.exec(readFileSync(`/proc/${pid}/status`, "utf8"))
    return match ? Number(match[1]) * 1024 : null
  } catch {
    return null
  }
}

interface ReaderQueue {
  running: boolean
  waiting: (() => void)[]
}

/** an `globalThis`: Next kann dieses Modul in mehreren Bündeln laden, dann gäbe es mehrere Schlangen */
function readerQueue(): ReaderQueue {
  const store = globalThis as { __spiegelPrintoutReader?: ReaderQueue }
  store.__spiegelPrintoutReader ??= { running: false, waiting: [] }
  return store.__spiegelPrintoutReader
}

export function readerState(): { running: boolean; waiting: number } {
  const queue = readerQueue()
  return { running: queue.running, waiting: queue.waiting.length }
}

const failed = (reason: ReadFailure): IsolatedRead => ({ kind: "failed", reason })

/** startet den Kindprozess; null, wenn schon `spawn` scheitert */
function startChild(script: string | undefined, maxParseMs: number) {
  try {
    return spawn(process.execPath, [...readerArgs(script), `--max-parse-ms=${maxParseMs}`], {
      env: childEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch {
    return null
  }
}

/** ein Kindprozess für ein PDF; löst immer auf, nie mit einem Fehler */
function runChild(bytes: Uint8Array, options: IsolatedReadOptions): Promise<IsolatedRead> {
  const maxParseMs = options.maxParseMs ?? DEFAULT_LIMITS.maxParseMs
  const startupMs = options.startupMs ?? STARTUP_MS
  const rssOf = options.rssOf ?? procRss

  return new Promise((resolve) => {
    const stdout: Buffer[] = []
    let stdoutBytes = 0
    const stderr: Buffer[] = []
    let stderrBytes = 0
    let ready = false
    let reason: ReadFailure | null = null
    let settled = false

    const child = startChild(options.script, maxParseMs)
    if (!child) return resolve(failed("crashed"))

    const stop = (why: ReadFailure) => {
      reason ??= why
      child.kill("SIGKILL")
    }
    let timer = setTimeout(() => stop("timeout"), startupMs)
    const watch = setInterval(() => {
      const rss = child.pid === undefined ? null : rssOf(child.pid)
      if (rss !== null && rss > CHILD_MAX_RSS_MB * 1024 * 1024) stop("memory")
    }, RSS_POLL_MS)

    const finish = (result: IsolatedRead) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(watch)
      resolve(result)
    }

    // EPIPE, wenn der Kindprozess schon beendet ist
    child.stdin.on("error", () => {})
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length
      if (stdoutBytes > OUTPUT_LIMIT) return stop("crashed")
      stdout.push(chunk)
      if (ready) return
      const text = Buffer.concat(stdout).toString("utf8")
      const newline = text.indexOf("\n")
      if (newline === -1) return
      if (text.slice(0, newline) !== READY_LINE) return stop("crashed")
      ready = true
      // ab hier gilt die Zeitgrenze des Lesens
      clearTimeout(timer)
      timer = setTimeout(() => stop("timeout"), maxParseMs)
      child.stdin.end(Buffer.from(bytes))
    })
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes >= STDERR_KEEP) return
      const part = chunk.subarray(0, STDERR_KEEP - stderrBytes)
      stderr.push(part)
      stderrBytes += part.length
    })
    child.on("error", () => {
      stop("crashed")
      finish(failed(reason ?? "crashed"))
    })
    child.on("close", (code, signal) => {
      if (reason) return finish(failed(reason))
      // SIGKILL, ohne dass die App ihn schickte: der OOM-Killer (`oom_score_adj` im Kindprozess)
      if (signal === "SIGKILL") return finish(failed("memory"))
      const line = ready ? Buffer.concat(stdout).toString("utf8").split("\n")[1] : undefined
      const result = code === 0 ? parseResult(line) : null
      if (result) return finish(result)
      const message = Buffer.concat(stderr).toString("utf8")
      finish(failed(/heap limit|out of memory/i.test(message) ? "memory" : "crashed"))
    })
  })
}

function parseResult(line: string | undefined): IsolatedRead | null {
  if (!line) return null
  let json: unknown
  try {
    json = JSON.parse(line)
  } catch {
    return null
  }
  const parsed = childResultSchema.safeParse(json)
  if (!parsed.success) return null
  const result = parsed.data
  if (!result.ok) return failed(result.code)
  return {
    kind: "read",
    pages: result.pages,
    id: result.id,
    createdAt: result.createdAt,
    maxRssKb: result.maxRssKb,
  }
}

/**
 * Liest ID und Erstellzeit eines Ausdrucks im Kindprozess. Einer zur Zeit, höchstens drei warten, sonst sofort `busy`.
 * Die Zeitgrenze `maxParseMs` beginnt erst, wenn der Kindprozess pdf.js geladen hat; den Start begrenzen eigene 5 s.
 * Ins Log gehen nur feste Gründe.
 */
export async function readPrintoutIsolated(
  bytes: Uint8Array,
  options: IsolatedReadOptions = {}
): Promise<IsolatedRead> {
  const queue = readerQueue()
  if (queue.running) {
    if (queue.waiting.length >= MAX_WAITING) return failed("busy")
    // der Vorgänger gibt seinen Platz direkt weiter, `running` bleibt wahr
    await new Promise<void>((resolve) => queue.waiting.push(resolve))
  } else {
    queue.running = true
  }
  try {
    const result = await runChild(bytes, options)
    if (
      result.kind === "failed" &&
      (result.reason === "timeout" || result.reason === "memory" || result.reason === "crashed")
    ) {
      console.warn(`Ausdruck im Kindprozess: ${result.reason}`)
    }
    return result
  } finally {
    const next = queue.waiting.shift()
    if (next) next()
    else queue.running = false
  }
}
