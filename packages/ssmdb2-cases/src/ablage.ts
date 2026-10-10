// Die Ablage im Speicher: Version, Scheiben, Serien, Treffer, wie die Tabellen der SSMDB2. Schlüssel wie die
// Primärschlüssel; `Serien` und `Treffer` hängen an ihrer Scheibe (Löschen kaskadiert wie im echten Schema).

import { SCHEMA_VERSION, type ScheibenRow, type SerienRow, type TrefferRow } from "./schema"

export interface Ablage {
  /** `Version.Versionsnummer` */
  version: number
  scheiben: Map<number, ScheibenRow>
  serien: Map<string, SerienRow>
  treffer: Map<string, TrefferRow>
}

export const emptyAblage = (version = SCHEMA_VERSION): Ablage => ({
  version,
  scheiben: new Map(),
  serien: new Map(),
  treffer: new Map(),
})

export const serienKey = (row: Pick<SerienRow, "ScheibenID" | "Stellung" | "Serie">) =>
  `${row.ScheibenID}/${row.Stellung}/${row.Serie}`
export const trefferKey = (row: Pick<TrefferRow, "ScheibenID" | "Stellung" | "Treffer">) =>
  `${row.ScheibenID}/${row.Stellung}/${row.Treffer}`

const byKey =
  <T extends { Stellung: number }>(order: (row: T) => number) =>
  (a: T, b: T) =>
    a.Stellung - b.Stellung || order(a) - order(b)

/** die Treffer einer Scheibe nach Primärschlüssel, wahlweise nur einer Stellung */
export function trefferOf(ablage: Ablage, scheibenId: number, stellung?: number): TrefferRow[] {
  return [...ablage.treffer.values()]
    .filter(
      (t) => t.ScheibenID === scheibenId && (stellung === undefined || t.Stellung === stellung)
    )
    .sort(byKey((t) => t.Treffer))
}

/** die Serien einer Scheibe nach Primärschlüssel, wahlweise nur einer Stellung */
export function serienOf(ablage: Ablage, scheibenId: number, stellung?: number): SerienRow[] {
  return [...ablage.serien.values()]
    .filter(
      (s) => s.ScheibenID === scheibenId && (stellung === undefined || s.Stellung === stellung)
    )
    .sort(byKey((s) => s.Serie))
}

/** eine Scheibe löschen; Serien und Treffer gehen mit (ON DELETE CASCADE) */
export function deleteScheibe(ablage: Ablage, scheibenId: number) {
  ablage.scheiben.delete(scheibenId)
  for (const row of serienOf(ablage, scheibenId)) ablage.serien.delete(serienKey(row))
  for (const row of trefferOf(ablage, scheibenId)) ablage.treffer.delete(trefferKey(row))
}
