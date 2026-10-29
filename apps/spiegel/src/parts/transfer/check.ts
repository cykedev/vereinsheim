// Der Prüfbestand einer Übernahme ([[adr-033]] Stufe 3 „Prüfbestand“): Was aus Treffsicher kam, gegen das, was danach in
// Spiegel steht. Rein; der Lauf liest beide Seiten in seiner Transaktion (`run.ts`). Jede Abweichung ohne Erklärung ist
// ein Befund und macht den Exit-Code des CLI 1.

/** eine Einheit: Ergebnis in Treffsicher und an der verknüpften Scheibe, in der Wertung von Treffsicher */
export interface CheckUnit {
  sessionId: string
  day: string
  decision: "existing" | "new" | "uncertain" | "probeEvening" | "noResult" | "notShooting"
  scoring: "WHOLE" | "TENTH"
  /** Schusszahl und Gesamtergebnis (Ringe bzw. Zehntel) in Treffsicher; null ohne Ergebnis */
  before: { shots: number; total: number | null } | null
  /** die Scheibe der Einheit (neu, unsicher oder die erste passende); null ohne */
  cardId: string | null
  /** die Scheibe wurde seit dem letzten Lauf geändert oder liegt im Papierkorb und bleibt */
  kept: boolean
  /** die Scheibe trägt die Werte ihres Ausdrucks (`adoptPrintoutValues`) */
  adopted?: boolean
  after: { shots: number; total: number | null } | null
}

/** eine Zeile der Vollständigkeit: Zahl vorher, Zahl nachher, Erklärung der Differenz */
export interface TableCheck {
  name: string
  before: number
  after: number
  explained: Record<string, number>
  note?: string
}

/** Stichprobe: je Feld der Text in Treffsicher und im Eintrag */
export interface SampleUnit {
  date: string
  kept: boolean
  fields: { field: string; before: string | null; after: string | null }[]
}

export type UnitStatus =
  | { kind: "same" }
  | { kind: "noResult" }
  | { kind: "explained"; reason: "probeEvening" | "kept" | "adopted" }
  | { kind: "finding"; reason: "noCard" | "different" }

export interface CheckResult {
  units: (CheckUnit & {
    status: UnitStatus
    /** Ø je Schuss vorher und nachher (ganze Ringe bzw. Zehntel je Schuss); null ohne */
    mean: { before: number | null; after: number | null }
  })[]
  tables: (TableCheck & { finding: boolean })[]
  sample: SampleUnit[]
  findings: number
}

const meanOf = (side: { shots: number; total: number | null } | null) =>
  side && side.total !== null && side.shots > 0 ? side.total / side.shots : null

/** der Zustand einer Einheit; ohne Gesamtergebnis in Treffsicher zählt nur die Schusszahl */
export function unitStatus(unit: CheckUnit): UnitStatus {
  if (!unit.before || unit.decision === "noResult" || unit.decision === "notShooting")
    return { kind: "noResult" }
  if (unit.decision === "probeEvening") return { kind: "explained", reason: "probeEvening" }
  if (unit.kept) return { kind: "explained", reason: "kept" }
  if (!unit.after) return { kind: "finding", reason: "noCard" }
  const same =
    unit.before.shots === unit.after.shots &&
    (unit.before.total === null || unit.before.total === unit.after.total)
  if (same) return { kind: "same" }
  if (unit.adopted) return { kind: "explained", reason: "adopted" }
  return { kind: "finding", reason: "different" }
}

/** eine Zeile geht auf: vorher = nachher + Erklärungen */
export const tableBalances = (table: TableCheck) =>
  table.before === table.after + Object.values(table.explained).reduce((sum, n) => sum + n, 0)

export function checkTransfer(input: {
  units: CheckUnit[]
  tables: TableCheck[]
  sample: SampleUnit[]
}): CheckResult {
  const units = input.units.map((unit) => ({
    ...unit,
    status: unitStatus(unit),
    mean: { before: meanOf(unit.before), after: meanOf(unit.after) },
  }))
  const tables = input.tables.map((table) => ({ ...table, finding: !tableBalances(table) }))
  return {
    units,
    tables,
    sample: input.sample,
    findings:
      units.filter((unit) => unit.status.kind === "finding").length +
      tables.filter((table) => table.finding).length,
  }
}
