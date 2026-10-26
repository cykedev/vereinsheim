// Holt einen Meyton-Ausdruck über den Link aus dem QR. Grenzen: höchstens 1 MiB, 10 s für alles, nur PDF, keine
// Weiterleitungen, damit kein Link auf ein anderes Ziel umgelenkt wird. Es gibt keine Liste erlaubter Adressen
// ([[adr-028]], Nachtrag vom 26. Oktober 2026): Ein Link kann Spiegel Adressen im eigenen Netz abrufen lassen
// (Restrisiko SF-47). Der Meyton-Link ist `http://`, HTTPS antwortet dort nicht.
//
// Nach außen geht nur ein fester Grund, nie Status oder Inhalt der Gegenseite.

import { hasPdfHeader } from "@vereinsheim/meyton-pdf/header"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"

import { safePdfName } from "./files"

export const FETCH_TIMEOUT_MS = 10_000
export const MAX_URL_LENGTH = 2_048

export type FetchFailure =
  "badUrl" | "redirect" | "httpStatus" | "unreachable" | "timeout" | "tooLarge" | "notPdf"

export type FetchResult =
  | { kind: "fetched"; bytes: Uint8Array; fileName: string | null }
  | { kind: "failed"; reason: FetchFailure }

const failed = (reason: FetchFailure): FetchResult => ({ kind: "failed", reason })

/** nur http(s), ohne Benutzer und Passwort in der Adresse; sonst null */
function parseUrl(raw: string): URL | null {
  if (raw.length > MAX_URL_LENGTH) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (url.username !== "" || url.password !== "") return null
  return url
}

/** der letzte Teil des Pfads als Dateiname, nur wenn er ein harmloser PDF-Name ist */
function fileNameOf(url: URL): string | null {
  const last = url.pathname.split("/").pop() ?? ""
  let name: string
  try {
    name = decodeURIComponent(last)
  } catch {
    return null
  }
  return safePdfName(name)
}

const isTimeout = (error: unknown) =>
  error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")

/** liest den Körper bis höchstens `maxBytes`; null, wenn er größer ist */
async function readLimited(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Uint8Array | null> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

export async function fetchPrintout(
  rawUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_LIMITS.maxBytes
  const url = parseUrl(rawUrl.trim())
  if (!url) return failed("badUrl")

  // eine Zeitgrenze für Verbindung, Kopf und Körper zusammen
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal,
      headers: {
        accept: "application/pdf",
        "accept-encoding": "identity",
        "user-agent": "Spiegel",
      },
    })
    if (response.status >= 300 && response.status <= 399) {
      await response.body?.cancel().catch(() => {})
      return failed("redirect")
    }
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel().catch(() => {})
      return failed("httpStatus")
    }
    const length = Number(response.headers.get("content-length"))
    if (Number.isFinite(length) && length > maxBytes) {
      await response.body.cancel().catch(() => {})
      return failed("tooLarge")
    }
    const bytes = await readLimited(response.body, maxBytes)
    if (!bytes) return failed("tooLarge")
    if (!hasPdfHeader(bytes)) return failed("notPdf")
    return { kind: "fetched", bytes, fileName: fileNameOf(url) }
  } catch (error) {
    return failed(isTimeout(error) || signal.aborted ? "timeout" : "unreachable")
  }
}
