// Zeilen der Rekorde R1–R8 (Plan L3, D12): Bezeichnung und Wert in der Wertung, rein, ohne React, damit Modelle wie
// das von Start sie nutzen können, ohne eine Client-Komponente zu laden (Review N5). Seit U5 (D3) in ganzen Worten,
// gezeigt als „Bezeichnung: Wert“: „Meiste 10,9 (20 Schuss): 1“ statt „meiste 10,9, 20 Schuss 1“.

import type { RecordRef } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { formatValue } from "../format"
import type { PeriodModel } from "./model"

export interface RecordRow {
  key: string
  label: string
  value: string
  record: RecordRef
}

/** die Zeilen der Rekorde R1–R8 in der Reihenfolge des Katalogs */
export function recordRows(records: PeriodModel["records"], scoring: Scoring): RecordRow[] {
  const ringDigits = scoring === "rings" ? 0 : 1
  const perKey = (
    table: Readonly<Record<number, RecordRef>>,
    label: (k: number) => string,
    value: (r: RecordRef) => string,
    prefix: string
  ) =>
    Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => ({
        key: `${prefix}:${k}`,
        label: label(k),
        value: value(table[k]),
        record: table[k],
      }))
  const one = (
    record: RecordRef | null,
    key: string,
    label: string,
    value: (r: RecordRef) => string
  ) => (record ? [{ key, label, value: value(record), record }] : [])
  const rings = (r: RecordRef) => `${formatValue(r.value, ringDigits)} Ringe`
  const count = (r: RecordRef) => String(r.value)
  return [
    ...perKey(records.bestCard, (k) => `Bestes Ergebnis (${k} Schuss)`, rings, "R1"),
    ...perKey(records.bestSeries, (k) => `Beste Serie (${k} Schuss)`, rings, "R2"),
    ...one(records.bestTeiler, "R3", "Bester Teiler", (r) => formatValue(r.value, 1)),
    ...one(
      records.tightestSeries,
      "R4s",
      "Engste Serie (10 Schuss)",
      (r) => `${formatValue(r.value, 1)} mm Streukreis`
    ),
    ...perKey(
      records.tightestCard,
      (k) => `Engste Scheibe (${k} Schuss)`,
      (r) => `${formatValue(r.value, 1)} mm Streukreis`,
      "R4"
    ),
    ...perKey(records.mostPerfect, (k) => `Meiste 10,9 (${k} Schuss)`, count, "R5"),
    ...perKey(records.mostTens, (k) => `Meiste Zehner (${k} Schuss)`, count, "R6z"),
    ...perKey(records.mostInnerTens, (k) => `Meiste Innenzehner (${k} Schuss)`, count, "R6i"),
    ...one(records.longestTenRun, "R7", "Längste Zehnerfolge", (r) => `${r.value} Schuss`),
    ...one(records.bestForm, "R8", "Beste Form (Ø über 5 Scheiben)", (r) =>
      formatValue(r.value, 2)
    ),
  ]
}
