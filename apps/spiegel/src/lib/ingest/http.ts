// HTTP-Schicht der Ingest-API v1 (Plan `plans/2026-10-13-spiegel-ingest.md`, D2–D4, D10, D15): Grenzen, bevor
// gerechnet wird. Die Handler nehmen eine `Request` und geben eine `Response`, damit Tests sie ohne Next prüfen; die
// Route Handler unter `src/app/api/ingest/v1/` reichen nur durch. Logs tragen nur Zahlen und feste Codes (SF-59).

import {
  heartbeatV1,
  pairRequestV1,
  type ApiErrorCode,
  type ErrorResponseV1,
  type HeartbeatResponseV1,
  type SnapshotsResponseV1,
} from "@vereinsheim/ingest-contract/api"
import {
  parseApi,
  parseSnapshotBatch,
  type ContractIssue,
} from "@vereinsheim/ingest-contract/parse"
import { extractClientIp } from "@vereinsheim/lib/auth/client-ip"

import type { Db } from "../db"
import {
  authenticateBridge,
  bridgeState,
  recordHeartbeat,
  redeemPairing,
  type AuthenticatedBridge,
} from "./bridges"
import { ingestBatch } from "./ingest"

/** Bytegrenzen je Anfrage (D2): ein Stapel bis 4 MiB, alles andere bis 16 KiB */
export const MAX_SNAPSHOTS_BYTES = 4 * 1024 * 1024
export const MAX_SMALL_BYTES = 16 * 1024
/** so viele Stapel gleichzeitig in Arbeit (D3); die übrigen bekommen 503 mit `Retry-After` */
export const MAX_CONCURRENT_BATCHES = 2

const MESSAGES: Record<ApiErrorCode, string> = {
  unauthorized: "Unbekanntes oder widerrufenes Gerät.",
  "rate-limited": "Zu viele Anfragen. Bitte später erneut senden.",
  busy: "Spiegel ist gerade ausgelastet. Bitte gleich erneut senden.",
  "too-large": "Die Anfrage ist zu groß. Bitte in kleineren Stapeln senden.",
  "unsupported-media-type": "Erwartet wird application/json.",
  invalid: "Die Lieferung entspricht nicht dem Vertrag.",
  "invalid-code": "Der Kopplungscode ist unbekannt, abgelaufen oder schon verwendet.",
  "not-found": "Unbekannter Endpunkt.",
  internal: "Interner Fehler. Bitte später erneut senden.",
}

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  "rate-limited": 429,
  busy: 503,
  "too-large": 413,
  "unsupported-media-type": 415,
  invalid: 400,
  "invalid-code": 401,
  "not-found": 404,
  internal: 500,
}

const HEADERS = { "content-type": "application/json", "cache-control": "no-store" }

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...headers } })
}

export function apiError(
  code: ApiErrorCode,
  { retryAfterSeconds, issues }: { retryAfterSeconds?: number; issues?: ContractIssue[] } = {}
): Response {
  const body: ErrorResponseV1 = {
    error: {
      code,
      message: MESSAGES[code],
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    },
    ...(issues ? { issues } : {}),
  }
  return json(
    body,
    STATUS[code],
    retryAfterSeconds ? { "retry-after": String(retryAfterSeconds) } : {}
  )
}

/** ein Eintrag im Log: nur Ereignis, Zahlen und feste Codes, nie Inhalte einer Lieferung (SF-59) */
export type LogFields = Record<string, number | boolean | null>
export type Log = (event: string, fields?: LogFields) => void
export const stdoutLog: Log = (event, fields = {}) =>
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...fields })}\n`)

// ─────────────────────────────────────────────────────────────────────────────
// Körper mit Grenze (D2)
// ─────────────────────────────────────────────────────────────────────────────

type Body = { ok: true; value: unknown } | { ok: false; response: Response }

/**
 * Den Körper lesen, höchstens `maxBytes`: `Content-Length` darüber sofort ablehnen, sonst beim Lesen abbrechen. Erst
 * danach `JSON.parse`; der Vertrag selbst begrenzt den Speicher nicht ([[spiegel-ingest-contract]], „Grenzen“).
 */
export async function readJson(request: Request, maxBytes: number): Promise<Body> {
  const type = request.headers.get("content-type") ?? ""
  if (!/^application\/json\b/i.test(type))
    return { ok: false, response: apiError("unsupported-media-type") }
  const length = Number(request.headers.get("content-length") ?? "")
  if (Number.isFinite(length) && length > maxBytes)
    return { ok: false, response: apiError("too-large") }
  if (!request.body) return { ok: false, response: apiError("invalid") }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return { ok: false, response: apiError("too-large") }
    }
    chunks.push(value)
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    return { ok: false, response: apiError("invalid") }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ratenbegrenzung und Parallelität (D3, D4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token-Bucket je Schlüssel im Arbeitsspeicher (ein Prozess): `capacity` Anfragen, die sich in `windowMs` wieder
 * auffüllen. Schützt die Last, nicht die Sicherheit (die liegt beim Token); ein Neustart leert ihn.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>()

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
    /** höchstens so viele Schlüssel; der älteste fällt heraus (Review: gefälschte Adressen ließen die Karte wachsen) */
    private readonly maxKeys = 5_000
  ) {}

  private level(key: string, nowMs: number): number {
    const bucket = this.buckets.get(key)
    if (!bucket) return this.capacity
    return Math.min(
      this.capacity,
      bucket.tokens + (nowMs - bucket.at) * (this.capacity / this.windowMs)
    )
  }

  private wait(tokens: number): number {
    return Math.max(1, Math.ceil((1 - tokens) / (this.capacity / this.windowMs) / 1000))
  }

  /** ohne zu verbrauchen: null, wenn ein Platz frei ist, sonst die Sekunden bis dahin */
  peek(key: string, nowMs = Date.now()): number | null {
    const tokens = this.level(key, nowMs)
    return tokens >= 1 ? null : this.wait(tokens)
  }

  /** null: erlaubt; sonst die Sekunden bis zum nächsten freien Platz */
  take(key: string, nowMs = Date.now()): number | null {
    const tokens = this.level(key, nowMs)
    // neu eingefügt steht der Schlüssel hinten; so ist der erste der am längsten nicht genutzte
    this.buckets.delete(key)
    if (this.buckets.size >= this.maxKeys) {
      const oldest = this.buckets.keys().next().value
      if (oldest !== undefined) this.buckets.delete(oldest)
    }
    if (tokens >= 1) {
      this.buckets.set(key, { tokens: tokens - 1, at: nowMs })
      return null
    }
    this.buckets.set(key, { tokens, at: nowMs })
    return this.wait(tokens)
  }

  get size(): number {
    return this.buckets.size
  }
}

/** höchstens `limit` gleichzeitig; ohne Warten, wer keinen Platz bekommt, bekommt `busy` */
export class Gate {
  private active = 0

  constructor(private readonly limit: number) {}

  tryEnter(): boolean {
    if (this.active >= this.limit) return false
    this.active++
    return true
  }

  leave(): void {
    this.active = Math.max(0, this.active - 1)
  }
}

export interface IngestDeps {
  db: Db
  now?: () => number
  log?: Log
  /** Proxy-Header vertrauen (wie die Anmeldung, `AUTH_TRUST_PROXY_HEADERS`) */
  trustProxyHeaders?: boolean
  limits?: Partial<Limits>
}

export interface Limits {
  snapshots: RateLimiter
  heartbeat: RateLimiter
  state: RateLimiter
  pairPerIp: RateLimiter
  pairAll: RateLimiter
  /** fehlgeschlagene Anmeldungen mit Token je Adresse: vor der Datenbank begrenzt (Review) */
  authFailures: RateLimiter
  batches: Gate
}

/** die Grenzen nach D3 und D4; je Prozess einmal (`defaultLimits`), in Tests frisch */
export function createLimits(): Limits {
  return {
    snapshots: new RateLimiter(20, 10_000),
    heartbeat: new RateLimiter(6, 60_000),
    state: new RateLimiter(6, 60_000),
    pairPerIp: new RateLimiter(5, 15 * 60_000),
    pairAll: new RateLimiter(30, 15 * 60_000),
    authFailures: new RateLimiter(30, 60_000),
    batches: new Gate(MAX_CONCURRENT_BATCHES),
  }
}

const globalLimits = globalThis as unknown as { spiegelIngestLimits?: Limits }
/** ein Satz Grenzen je Prozess, auch über das Neuladen der Entwicklung hinweg */
export const defaultLimits = (): Limits => (globalLimits.spiegelIngestLimits ??= createLimits())

function setup(deps: IngestDeps) {
  return {
    db: deps.db,
    now: deps.now ?? Date.now,
    log: deps.log ?? stdoutLog,
    limits: { ...defaultLimits(), ...deps.limits },
    trust: deps.trustProxyHeaders ?? false,
  }
}

const bearer = (request: Request) =>
  /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1]?.trim() ?? null

const clientKey = (request: Request, trust: boolean) =>
  `ip:${extractClientIp(Object.fromEntries(request.headers), trust) ?? "unbekannt"}`

/**
 * Anmeldung der Brücke; eine Antwort heißt: abgelehnt. Wer zu oft mit falschem Token kommt, wird vor der Datenbank
 * abgewiesen, damit eine Flut den Pool nicht bindet (Review).
 */
async function authenticate(
  request: Request,
  deps: ReturnType<typeof setup>
): Promise<AuthenticatedBridge | Response> {
  const key = clientKey(request, deps.trust)
  const wait = deps.limits.authFailures.peek(key, deps.now())
  if (wait !== null) return apiError("rate-limited", { retryAfterSeconds: wait })
  const bridge = await authenticateBridge(deps.db, bearer(request), deps.now())
  if (!bridge) {
    deps.limits.authFailures.take(key, deps.now())
    return apiError("unauthorized")
  }
  return bridge
}

/** die Ratenbegrenzung der Brücke; eine Antwort heißt: abgelehnt */
function limit(
  bridge: AuthenticatedBridge,
  deps: ReturnType<typeof setup>,
  limiter: RateLimiter
): Response | null {
  const wait = limiter.take(`bridge:${bridge.bridgeId}`, deps.now())
  if (wait === null) return null
  deps.log("ingest.rate-limited", { bridge: bridge.bridgeId, retryAfter: wait })
  return apiError("rate-limited", { retryAfterSeconds: wait })
}

/** unerwartete Fehler: nur ihr Name ins Log, nie die Meldung (Prisma nennt darin Werte) */
function internal(deps: ReturnType<typeof setup>, event: string, error: unknown): Response {
  deps.log(event, { failed: true })
  process.stderr.write(`${event}: ${error instanceof Error ? error.name : "Fehler"}\n`)
  return apiError("internal")
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpunkte
// ─────────────────────────────────────────────────────────────────────────────

/** `POST /api/ingest/v1/pair` */
export async function handlePair(request: Request, deps: IngestDeps): Promise<Response> {
  const d = setup(deps)
  try {
    // erst der gemeinsame Eimer: gefälschte Adressen sollen ihn nicht umgehen (Review)
    const wait =
      d.limits.pairAll.take("all", d.now()) ??
      d.limits.pairPerIp.take(clientKey(request, d.trust), d.now())
    if (wait !== null) {
      d.log("ingest.pair.rate-limited", { retryAfter: wait })
      return apiError("rate-limited", { retryAfterSeconds: wait })
    }
    const body = await readJson(request, MAX_SMALL_BYTES)
    if (!body.ok) return body.response
    const parsed = parseApi(pairRequestV1, body.value)
    if (!parsed.ok) return apiError("invalid", { issues: parsed.issues })
    const paired = await redeemPairing(d.db, { ...parsed.value, nowMs: d.now() })
    if (!paired) {
      d.log("ingest.pair.rejected")
      return apiError("invalid-code")
    }
    d.log("ingest.pair", { bridge: paired.bridgeId })
    return json(paired)
  } catch (error) {
    return internal(d, "ingest.pair.failed", error)
  }
}

/** `POST /api/ingest/v1/snapshots` */
export async function handleSnapshots(request: Request, deps: IngestDeps): Promise<Response> {
  const d = setup(deps)
  let entered = false
  try {
    const bridge = await authenticate(request, d)
    if (bridge instanceof Response) return bridge
    // erst der Platz, dann ein Token: wer nach 503 wartet, verbraucht keinen (Review)
    if (!d.limits.batches.tryEnter()) {
      d.log("ingest.busy", { bridge: bridge.bridgeId })
      return apiError("busy", { retryAfterSeconds: 2 })
    }
    entered = true
    const limited = limit(bridge, d, d.limits.snapshots)
    if (limited) return limited
    const started = d.now()
    const body = await readJson(request, MAX_SNAPSHOTS_BYTES)
    if (!body.ok) return body.response
    const parsed = parseSnapshotBatch(body.value)
    if (!parsed.ok) {
      d.log("ingest.invalid", { bridge: bridge.bridgeId, issues: parsed.issues.length })
      return apiError("invalid", { issues: parsed.issues })
    }
    const results = await ingestBatch(
      d.db,
      { bridgeId: bridge.bridgeId, siteId: bridge.siteId, timeZone: bridge.timeZone },
      parsed.value.snapshots,
      { nowMs: d.now() }
    )
    const count = (outcome: string) => results.filter((r) => r.outcome === outcome).length
    d.log("ingest.snapshots", {
      bridge: bridge.bridgeId,
      snapshots: results.length,
      stored: count("stored"),
      lifesign: count("lifesign"),
      unchanged: count("unchanged"),
      discarded: count("discarded"),
      quarantined: count("quarantined"),
      ms: d.now() - started,
    })
    const response: SnapshotsResponseV1 = { results }
    return json(response)
  } catch (error) {
    return internal(d, "ingest.snapshots.failed", error)
  } finally {
    if (entered) d.limits.batches.leave()
  }
}

/** `POST /api/ingest/v1/heartbeat` */
export async function handleHeartbeat(request: Request, deps: IngestDeps): Promise<Response> {
  const d = setup(deps)
  try {
    const bridge = await authenticate(request, d)
    if (bridge instanceof Response) return bridge
    const limited = limit(bridge, d, d.limits.heartbeat)
    if (limited) return limited
    const body = await readJson(request, MAX_SMALL_BYTES)
    if (!body.ok) return body.response
    const parsed = parseApi(heartbeatV1, body.value)
    if (!parsed.ok) return apiError("invalid", { issues: parsed.issues })
    await recordHeartbeat(d.db, bridge, parsed.value, d.now())
    const response: HeartbeatResponseV1 = { serverTime: new Date(d.now()).toISOString() }
    return json(response)
  } catch (error) {
    return internal(d, "ingest.heartbeat.failed", error)
  }
}

/** `GET /api/ingest/v1/state` */
export async function handleState(request: Request, deps: IngestDeps): Promise<Response> {
  const d = setup(deps)
  try {
    const bridge = await authenticate(request, d)
    if (bridge instanceof Response) return bridge
    const limited = limit(bridge, d, d.limits.state)
    if (limited) return limited
    return json(await bridgeState(d.db, bridge.siteId, d.now()))
  } catch (error) {
    return internal(d, "ingest.state.failed", error)
  }
}
