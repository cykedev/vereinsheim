import { createHash } from "node:crypto"

import { canonicalize, compareUtf16 } from "./canonical"
import type { SnapshotDataV1 } from "./v1/snapshot"

/**
 * Prüfsumme eines Snapshots (SF-27): SHA-256 über die kanonische Form von `data`, die Zeilen jeder
 * Tabelle sortiert nach ihrer eigenen kanonischen Form. Die Hülle (Folgenummer, Beobachtungszeit, …)
 * geht nicht ein: Ein unveränderter Stand hat dieselbe Prüfsumme, egal wann und wie oft er kommt.
 * Reihenfolge von Zeilen und Spalten spielt keine Rolle (`SELECT` ohne `ORDER BY` ist erlaubt).
 */
export function canonicalData(data: SnapshotDataV1): string {
  const tables = Object.fromEntries(
    Object.entries(data).map(([name, table]) => [
      name,
      { columns: table.columns, rows: sortRows(table.rows) },
    ])
  )
  return canonicalize(tables)
}

function sortRows(rows: readonly object[]): unknown[] {
  return rows
    .map((row) => ({ row, key: canonicalize(row) }))
    .sort((a, b) => compareUtf16(a.key, b.key))
    .map(({ row }) => row)
}

export function computeChecksum(data: SnapshotDataV1): string {
  return `sha256:${createHash("sha256").update(canonicalData(data), "utf8").digest("hex")}`
}
