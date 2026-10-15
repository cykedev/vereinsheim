import type { z, ZodType } from "zod"

import { computeChecksum } from "./checksum"
import { LIMITS } from "./limits"
import { CONTRACT_ISSUE, snapshotV1, type SnapshotV1 } from "./v1/snapshot"
import { isSupportedContractVersion } from "./versions"

/**
 * Prüft eingehende Snapshots gegen den Vertrag. Fehler nennen nur Pfad und Code, **nie Inhalte**:
 * In den Zeilen stehen Namen, und Validierungsfehler landen in Logs (SF-59). Pfade enden deshalb an
 * `columns` und `rows[i]`; Spaltennamen und Werte tauchen nicht auf.
 */

/** Ein Snapshot in einer unterstützten Vertragsversion; mit v2 wird das eine Union. */
export type Snapshot = SnapshotV1

export type ContractIssue = { path: string; code: string }

export type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: ContractIssue[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Pfad ohne Inhalte: Unter `columns` und unterhalb von `rows[i]` stehen Daten, dort endet er. */
function safePath(path: readonly PropertyKey[]): string {
  let out = ""
  for (const [index, segment] of path.entries()) {
    if (typeof segment === "number") {
      out += `[${segment}]`
      if (path[index - 1] === "rows") break
    } else {
      out += out ? `.${String(segment)}` : String(segment)
      if (segment === "columns") break
    }
  }
  return out
}

function issueCode(issue: z.core.$ZodIssue): string {
  const contractCode: unknown = issue.code === "custom" ? issue.params?.contractCode : undefined
  return typeof contractCode === "string" ? contractCode : issue.code
}

function toIssues(error: z.ZodError, prefix: string): ContractIssue[] {
  return error.issues.map((issue) => {
    return { path: withPrefix(prefix, safePath(issue.path)), code: issueCode(issue) }
  })
}

function limited(issues: ContractIssue[]): ContractIssue[] {
  return issues.slice(0, LIMITS.maxReportedIssues)
}

/** Tiefer als Hülle → data → Tabelle → rows → Zeile geht kein gültiger Snapshot; Zod lehnt das ab. */
const MAX_WALK_DEPTH = 6

/**
 * Sucht einen eigenen Schlüssel `__proto__`. `JSON.parse` legt ihn als normalen Schlüssel an, Zod
 * verwirft ihn still statt ihn abzulehnen; eine Zeile mit ihm passierte sonst die Spaltenprüfung,
 * und die Prüfsumme der Brücke schlösse ihn ein. Liefert den Pfad bis zum Objekt, das ihn trägt.
 */
function findForbiddenKey(value: unknown, path: PropertyKey[]): PropertyKey[] | null {
  if (path.length > MAX_WALK_DEPTH || typeof value !== "object" || value === null) return null
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const hit = findForbiddenKey(item, [...path, index])
      if (hit) return hit
    }
    return null
  }
  if (Object.hasOwn(value, "__proto__")) return path
  for (const [key, item] of Object.entries(value)) {
    const hit = findForbiddenKey(item, [...path, key])
    if (hit) return hit
  }
  return null
}

function withPrefix(prefix: string, path: string): string {
  return prefix && path ? `${prefix}.${path}` : prefix || path
}

function checkSnapshot(input: unknown, prefix: string): ParseResult<Snapshot> {
  if (!isPlainObject(input)) {
    return { ok: false, issues: [{ path: prefix, code: "invalid_type" }] }
  }
  if (!isSupportedContractVersion(input.contractVersion)) {
    const path = withPrefix(prefix, "contractVersion")
    return { ok: false, issues: [{ path, code: CONTRACT_ISSUE.unsupportedVersion }] }
  }
  const forbidden = findForbiddenKey(input, [])
  if (forbidden) {
    const path = withPrefix(prefix, safePath(forbidden))
    return { ok: false, issues: [{ path, code: CONTRACT_ISSUE.forbiddenKey }] }
  }
  // Nur v1; eine v2 bekommt hier ihren Zweig, v1 bleibt mindestens eine Version lang.
  const parsed = snapshotV1.safeParse(input)
  if (!parsed.success) {
    return { ok: false, issues: toIssues(parsed.error, prefix) }
  }
  if (computeChecksum(parsed.data.data) !== parsed.data.checksum) {
    const path = withPrefix(prefix, "checksum")
    return { ok: false, issues: [{ path, code: CONTRACT_ISSUE.checksumMismatch }] }
  }
  return { ok: true, value: parsed.data }
}

export function parseSnapshot(input: unknown): ParseResult<Snapshot> {
  const result = checkSnapshot(input, "")
  return result.ok ? result : { ok: false, issues: limited(result.issues) }
}

/**
 * Ein Stapel ist nur als Ganzes gültig; die Fehler nennen den betroffenen Snapshot. Die Form prüft
 * diese Funktion selbst, damit jeder Snapshot durch `checkSnapshot` läuft (Version, `__proto__`,
 * Prüfsumme); `snapshotBatchV1` beschreibt dieselbe Form für das JSON-Schema. Beide gleich halten.
 */
export function parseSnapshotBatch(input: unknown): ParseResult<{ snapshots: Snapshot[] }> {
  if (!isPlainObject(input)) {
    return { ok: false, issues: [{ path: "", code: "invalid_type" }] }
  }
  const extra = Object.keys(input).filter((key) => key !== "snapshots")
  if (extra.length > 0) {
    return { ok: false, issues: [{ path: "", code: "unrecognized_keys" }] }
  }
  const { snapshots } = input
  if (!Array.isArray(snapshots)) {
    return { ok: false, issues: [{ path: "snapshots", code: "invalid_type" }] }
  }
  if (snapshots.length < 1) {
    return { ok: false, issues: [{ path: "snapshots", code: "too_small" }] }
  }
  if (snapshots.length > LIMITS.maxBatchSnapshots) {
    return { ok: false, issues: [{ path: "snapshots", code: "too_big" }] }
  }
  const values: Snapshot[] = []
  const issues: ContractIssue[] = []
  snapshots.forEach((snapshot: unknown, index) => {
    const result = checkSnapshot(snapshot, `snapshots[${index}]`)
    if (result.ok) values.push(result.value)
    else issues.push(...result.issues)
  })
  return issues.length > 0
    ? { ok: false, issues: limited(issues) }
    : { ok: true, value: { snapshots: values } }
}

/**
 * Eine Anfrage der API außer dem Stapel (`pair`, `heartbeat`) gegen ihr Schema prüfen, mit Fehlern ohne Inhalt wie beim
 * Snapshot. Auch hier `__proto__` verboten: Zod verwürfe ihn still.
 */
export function parseApi<T>(schema: ZodType<T>, input: unknown): ParseResult<T> {
  if (!isPlainObject(input)) return { ok: false, issues: [{ path: "", code: "invalid_type" }] }
  if (!isSupportedContractVersion(input.contractVersion)) {
    return {
      ok: false,
      issues: [{ path: "contractVersion", code: CONTRACT_ISSUE.unsupportedVersion }],
    }
  }
  const forbidden = findForbiddenKey(input, [])
  if (forbidden) {
    return { ok: false, issues: [{ path: safePath(forbidden), code: CONTRACT_ISSUE.forbiddenKey }] }
  }
  const parsed = schema.safeParse(input)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, issues: limited(toIssues(parsed.error, "")) }
}
