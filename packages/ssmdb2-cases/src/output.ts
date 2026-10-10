// Ausgaben eines Falls: je Lesung und Scheibe ein Snapshot v1 (wie die Brücke ihn schicken würde) und je Schritt die
// SQL-Anweisungen, die die Ablage vom vorigen Stand in diesen bringen. Zellen als Text wie das MySQL-Textprotokoll
// (Ganzzahlen als Dezimaltext); das Schema kennt kein NULL.

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotDataV1, SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"

import { serienOf, trefferOf, type Ablage } from "./ablage"
import { COLUMNS, PRIMARY_KEYS, TABLES, type Table } from "./schema"
import type { Reading } from "./stand"

/** Sitzungs-Zeitzone, die die Brücke fest setzt und mitsendet (Vault-Note spiegel-ingest-contract) */
export const SESSION_TIME_ZONE = "+00:00"

type Row = Record<string, string | number>
/** Zeilen der Ablage als allgemeine Zeilen (die Typen der Tabellen sind schmaler) */
const asRows = (rows: Iterable<object>) => [...rows] as Row[]

/** eine Zelle wie das MySQL-Textprotokoll: Ganzzahlen als Dezimaltext, Text und Datum unverändert */
export const textCell = (value: string | number): string => String(value)

const textRow = (table: Table, row: Row) =>
  Object.fromEntries(Object.keys(COLUMNS[table]).map((column) => [column, textCell(row[column])]))

/** die Zeilen einer Scheibe je Tabelle, nach Primärschlüssel */
function rowsOf(ablage: Ablage, scheibenId: number): Record<Table, Row[]> {
  const scheibe = ablage.scheiben.get(scheibenId)
  return {
    Scheiben: asRows(scheibe ? [scheibe] : []),
    Serien: asRows(serienOf(ablage, scheibenId)),
    Treffer: asRows(trefferOf(ablage, scheibenId)),
  }
}

function snapshotData(ablage: Ablage, scheibenId: number): SnapshotDataV1 {
  const rows = rowsOf(ablage, scheibenId)
  const table = (name: Table) => ({
    columns: { ...COLUMNS[name] },
    rows: rows[name].map((row) => textRow(name, row)),
  })
  return { scheiben: table("Scheiben"), serien: table("Serien"), treffer: table("Treffer") }
}

export interface ReadingOutput {
  /** Nummer der Lesung, ab 1 */
  reading: number
  note: string
  /** nur eine Abfrage lang zu sehen (SF-71) */
  transient: boolean
  observedAt: string
  /** je Scheibe in der Ablage ein Snapshot, nach ScheibenID */
  snapshots: SnapshotV1[]
}

/**
 * je Lesung und Scheibe ein Snapshot v1. Die Folgenummer ist die Beobachtungszeit in ms (wie in der Brücke, SF-26),
 * die Epoche 1. Ob die Brücke ihn sendet, sagt das erwartete Ergebnis, nicht diese Ausgabe.
 */
export function readingSnapshots(readings: readonly Reading[]): ReadingOutput[] {
  return readings.map((reading, i) => {
    const observedAt = new Date(reading.observedAtMs).toISOString()
    const ids = [...reading.ablage.scheiben.keys()].sort((a, b) => a - b)
    const snapshots = ids.map((scheibenId): SnapshotV1 => {
      const data = snapshotData(reading.ablage, scheibenId)
      return {
        contractVersion: 1,
        source: "meyton-ssmdb2",
        sourceVersion: String(reading.ablage.version),
        epoch: 1,
        scheibenId,
        sequence: reading.observedAtMs,
        observedAt,
        sessionTimeZone: SESSION_TIME_ZONE,
        data,
        checksum: computeChecksum(data),
      }
    })
    return {
      reading: i + 1,
      note: reading.note,
      transient: reading.transient,
      observedAt,
      snapshots,
    }
  })
}

/** ein Wert als SQL-Literal: Zahlen unverändert, Text in Hochkommas (verdoppelt); einen Backslash gibt es nicht */
export function sqlLiteral(value: string | number): string {
  if (typeof value === "number") return String(value)
  if (value.includes("\\")) throw new Error("Backslash im Text: MariaDB läse ihn als Escape")
  return `'${value.replaceAll("'", "''")}'`
}

const name = (identifier: string) => `\`${identifier}\``

const allRows = (ablage: Ablage): Record<Table, Map<string, Row>> => {
  const keyed = (table: Table, rows: Iterable<object>) =>
    new Map(asRows(rows).map((row) => [PRIMARY_KEYS[table].map((k) => row[k]).join("/"), row]))
  return {
    Scheiben: keyed("Scheiben", ablage.scheiben.values()),
    Serien: keyed("Serien", ablage.serien.values()),
    Treffer: keyed("Treffer", ablage.treffer.values()),
  }
}

const where = (table: Table, row: Row) =>
  PRIMARY_KEYS[table].map((k) => `${name(k)} = ${sqlLiteral(row[k])}`).join(" AND ")

const insert = (table: Table, row: Row) => {
  const columns = Object.keys(COLUMNS[table])
  return `INSERT INTO ${name(table)} (${columns.map(name).join(", ")}) VALUES (${columns
    .map((c) => sqlLiteral(row[c]))
    .join(", ")});`
}

/** Reihenfolge der Schlüssel wie die Brücke liest (Primärschlüssel, Zahlen numerisch) */
const byKey = (table: Table) => (a: Row, b: Row) => {
  for (const k of PRIMARY_KEYS[table]) {
    const d = Number(a[k]) - Number(b[k])
    if (d) return d
  }
  return 0
}

/**
 * die Anweisungen, die `before` in `after` überführen (ohne `before`: alles anlegen, mit `Version`). Erst löschen
 * (Treffer, Serien, dann Scheiben; die Kaskade nähme sie ohnehin mit), dann Scheiben anlegen oder ändern, dann Serien
 * und Treffer. Ohne Unterschied leer. Ein Schlüssel, der wiederkehrt (Neustart der Probe), wird ein `UPDATE`, wo
 * Meyton löscht und einfügt; der Stand danach ist derselbe.
 */
export function stepSql(before: Ablage | null, after: Ablage): string {
  const lines: string[] = []
  if (!before)
    lines.push(
      `INSERT INTO ${name("Version")} (${name("Versionsnummer")}) VALUES (${after.version});`
    )
  else if (before.version !== after.version)
    lines.push(`UPDATE ${name("Version")} SET ${name("Versionsnummer")} = ${after.version};`)
  const old = before ? allRows(before) : null
  const now = allRows(after)
  for (const table of ["Treffer", "Serien", "Scheiben"] as const) {
    const gone = [...(old?.[table] ?? new Map()).entries()].filter(([key]) => !now[table].has(key))
    for (const [, row] of gone.sort((a, b) => byKey(table)(a[1], b[1])))
      lines.push(`DELETE FROM ${name(table)} WHERE ${where(table, row)};`)
  }
  for (const table of TABLES) {
    for (const [key, row] of [...now[table].entries()].sort((a, b) => byKey(table)(a[1], b[1]))) {
      const previous = old?.[table].get(key)
      if (!previous) {
        lines.push(insert(table, row))
        continue
      }
      const changed = Object.keys(COLUMNS[table]).filter((c) => previous[c] !== row[c])
      if (changed.length)
        lines.push(
          `UPDATE ${name(table)} SET ${changed
            .map((c) => `${name(c)} = ${sqlLiteral(row[c])}`)
            .join(", ")} WHERE ${where(table, row)};`
        )
    }
  }
  return lines.length ? `${lines.join("\n")}\n` : ""
}
