// Die Regeln der geprüften Zuordnungsdatei (`reports/tis-v1/zuordnung-<Tag>.csv`, [[spiegel-account-transfer]]) für
// `vereinsheim transfer --mapping`, rein. E-Mails werden über `normalizeEmail` verglichen; nach außen gehen nur Zeilen
// und Hashes (`accountHash`).

import { normalizeEmail, type MappingRow } from "../../src/lib/transfer/accountMatch"
import { accountHash } from "./account-hash"

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
