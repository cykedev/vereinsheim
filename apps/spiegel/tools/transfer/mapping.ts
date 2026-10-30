// Die Regeln der geprüften Zuordnungsdatei (`reports/tis-v1/zuordnung-<Tag>.csv`, [[spiegel-account-transfer]]) für
// `vereinsheim transfer --mapping`, rein. E-Mails werden über `normalizeEmail` verglichen; nach außen gehen nur Zeilen
// und Hashes (`accountHash`).

import { normalizeEmail, type MappingRow } from "../../src/lib/transfer/accountMatch"
import { accountHash, emailHash } from "./account-hash"

export type MappingLine = MappingRow & { line: number }

/** eine Zeile, die läuft: ein Konto aus Treffsicher in ein Konto in Spiegel */
export interface MappingRun {
  line: number
  from: string
  to: string
  hash: string
}

/** `check`: ein Mensch entscheidet noch; `checkPending`: `ok`/`new` eines `from`, zu dem noch eine `check`-Zeile steht */
export type RejectReason = "check" | "checkPending"

export type MappingPlan =
  | {
      kind: "ok"
      runs: MappingRun[]
      rejected: { line: number; hash: string; reason: RejectReason }[]
    }
  /** je Gruppe die Zeilen eines `from` mit verschiedenem `to` bzw. eines `to` mit verschiedenem `from` */
  | { kind: "conflict"; fromConflicts: number[][]; toConflicts: number[][] }

const runs = (rows: readonly MappingLine[]) => rows.filter((row) => row.status !== "check")

/** Gruppen von Zeilen, deren Schlüssel (`key`) gleich ist und deren Gegenseite (`other`) verschieden */
function conflicts(
  rows: readonly MappingLine[],
  key: (row: MappingLine) => string,
  other: (row: MappingLine) => string
): number[][] {
  const groups = new Map<string, MappingLine[]>()
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row])
  return [...groups.values()]
    .filter((group) => new Set(group.map(other)).size > 1)
    .map((group) => group.map((row) => row.line))
}

/**
 * Was die Datei laufen lässt: Widersprüche unter `ok`/`new` (ein `from` mit zwei `to`, zwei `from` auf ein `to`) brechen
 * die ganze Datei ab, bevor ein Lauf startet; `check` und `checkPending` laufen nicht; gleiche Zeilen einmal, unter der
 * ersten Nummer.
 */
export function planMapping(rows: readonly MappingLine[]): MappingPlan {
  const from = (row: MappingLine) => normalizeEmail(row.from)
  const to = (row: MappingLine) => normalizeEmail(row.to)
  const fromConflicts = conflicts(runs(rows), from, to)
  const toConflicts = conflicts(runs(rows), to, from)
  if (fromConflicts.length || toConflicts.length)
    return { kind: "conflict", fromConflicts, toConflicts }

  const checked = new Set(rows.filter((row) => row.status === "check").map(from))
  const plan: Extract<MappingPlan, { kind: "ok" }> = { kind: "ok", runs: [], rejected: [] }
  const seen = new Set<string>()
  for (const row of rows) {
    const hash = accountHash(row.from)
    if (row.status === "check") plan.rejected.push({ line: row.line, hash, reason: "check" })
    else if (checked.has(from(row)))
      plan.rejected.push({ line: row.line, hash, reason: "checkPending" })
    else if (!seen.has(from(row))) {
      seen.add(from(row))
      plan.runs.push({ line: row.line, from: row.from, to: row.to, hash })
    }
  }
  return plan
}

/** je Konto in Treffsicher (Hash der E-Mail, 64 Zeichen) das Merkmal „umgezogen“ (`treffsicher-status.sql`) */
export function parseTreffsicherStatus(text: string): Map<string, { moved: boolean }> {
  const status = new Map<string, { moved: boolean }>()
  text.split("\n").forEach((line, index) => {
    if (!line.trim()) return
    const match = /^([0-9a-f]{64})\|([01])$/.exec(line.trim())
    if (!match) throw new Error(`Status Treffsicher Zeile ${index + 1}: unerwartet`)
    status.set(match[1], { moved: match[2] === "1" })
  })
  return status
}

/** je Konto in Spiegel mit Läufen (Hash der E-Mail) die Zahl der Läufe und den letzten Tag (`spiegel-status.sql`) */
export function parseSpiegelStatus(
  text: string
): Map<string, { runs: number; last: string | null }> {
  const status = new Map<string, { runs: number; last: string | null }>()
  text.split("\n").forEach((line, index) => {
    if (!line.trim()) return
    const match = /^([0-9a-f]{64})\|(\d+)\|(\d{4}-\d{2}-\d{2})?$/.exec(line.trim())
    if (!match) throw new Error(`Status Spiegel Zeile ${index + 1}: unerwartet`)
    status.set(match[1], { runs: Number(match[2]), last: match[3] ?? null })
  })
  return status
}

export type MappingState =
  | "übernommen"
  | "Merkmal fehlt"
  | "Merkmal ohne Lauf"
  | "offen"
  | "zu prüfen"
  | "fehlt in Treffsicher"

/**
 * je Zeile der Datei ihr Zustand: das Merkmal am Konto in Treffsicher (`from`), die Läufe am Konto in Spiegel (`to`),
 * verbunden über den Hash der E-Mail
 */
export function statusRows(
  rows: readonly MappingLine[],
  treffsicher: ReadonlyMap<string, { moved: boolean }>,
  spiegel: ReadonlyMap<string, { runs: number }>
): { line: number; hash: string; state: MappingState }[] {
  const checked = new Set(
    rows.filter((row) => row.status === "check").map((row) => normalizeEmail(row.from))
  )
  return rows.map((row) => {
    const hash = accountHash(row.from)
    const state = (): MappingState => {
      if (row.status === "check" || checked.has(normalizeEmail(row.from))) return "zu prüfen"
      const source = treffsicher.get(emailHash(row.from))
      if (!source) return "fehlt in Treffsicher"
      const ran = (spiegel.get(emailHash(row.to))?.runs ?? 0) > 0
      if (ran) return source.moved ? "übernommen" : "Merkmal fehlt"
      return source.moved ? "Merkmal ohne Lauf" : "offen"
    }
    return { line: row.line, hash, state: state() }
  })
}

/** Konten in Treffsicher, die in keiner Zeile der Datei als `from` stehen */
export function outsideMapping(
  treffsicher: ReadonlyMap<string, unknown>,
  rows: readonly MappingLine[]
): number {
  const inFile = new Set(rows.map((row) => emailHash(row.from)))
  return [...treffsicher.keys()].filter((hash) => !inFile.has(hash)).length
}
