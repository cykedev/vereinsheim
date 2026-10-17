// Zeilen der Rekorde R1–R8, R10, R11: Bezeichnung und Wert in der Wertung, rein, ohne React, damit Modelle wie das von
// Start sie nutzen können, ohne eine Client-Komponente zu laden. In ganzen Worten, gezeigt als „Bezeichnung: Wert“, etwa
// „Meiste 10,9 auf einer Scheibe zu 20 Schuss: 1“. Jede Bezeichnung sagt, ob eine Scheibe oder eine Serie gemeint ist,
// denn „10 Schuss“ allein passt auf eine Scheibe zu zehn und auf eine Serie zu zehn.

import type { RecordRef } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { formatValue, ringsText } from "../format"
import type { PeriodModel } from "./model"

/** so viele neue Rekorde stehen oben im Fortschritt und je Abend auf Start */
export const NEW_RECORDS = 5

export interface RecordRow {
  key: string
  label: string
  value: string
  record: RecordRef
}

/** die Zeilen der Rekorde R1–R8, R10, R11 in der Reihenfolge des Katalogs */
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
  const rings = (r: RecordRef) => ringsText(r.value, ringDigits)
  const count = (r: RecordRef) => String(r.value)
  const shots = (r: RecordRef) => `${r.value} Schuss`
  const card = (k: number) => `Scheibe zu ${k} Schuss`
  const series = (k: number) => `Serie zu ${k} Schuss`
  return [
    ...perKey(records.bestCard, (k) => `Bestes Ergebnis, ${card(k)}`, rings, "R1"),
    ...perKey(records.bestSeries, (k) => `Beste ${series(k)}`, rings, "R2"),
    ...one(records.bestTeiler, "R3", "Bester Teiler", (r) => formatValue(r.value, 1)),
    ...one(
      records.tightestSeries,
      "R4s",
      `Engste ${series(10)}`,
      (r) => `${formatValue(r.value, 1)} mm Streukreis`
    ),
    ...perKey(
      records.tightestCard,
      (k) => `Engste ${card(k)}`,
      (r) => `${formatValue(r.value, 1)} mm Streukreis`,
      "R4"
    ),
    ...perKey(records.mostPerfect, (k) => `Meiste 10,9 auf einer ${card(k)}`, count, "R5"),
    ...perKey(records.mostTens, (k) => `Meiste Zehner auf einer ${card(k)}`, count, "R6z"),
    ...perKey(records.mostTensSeries, (k) => `Meiste Zehner in einer ${series(k)}`, count, "R6zs"),
    ...perKey(
      records.mostInnerTens,
      (k) => `Meiste Innenzehner auf einer ${card(k)}`,
      count,
      "R6i"
    ),
    ...perKey(
      records.mostInnerTensSeries,
      (k) => `Meiste Innenzehner in einer ${series(k)}`,
      count,
      "R6is"
    ),
    ...one(records.longestTenRun, "R7", "Längste Zehnerfolge", shots),
    ...one(records.longestNineRun, "R7n", "Längste Folge ohne Schuss unter 9", shots),
    ...one(records.bestForm, "R8", "Beste Form (Ø über 5 Scheiben)", (r) =>
      formatValue(r.value, 2)
    ),
    ...perKey(
      records.bestWeakestShot,
      (k) => `Bester schwächster Schuss, ${card(k)}`,
      rings,
      "R10"
    ),
    ...perKey(
      records.smallestSeriesSpan,
      (k) => `Kleinste Spanne der Serien, ${card(k)}`,
      rings,
      "R11"
    ),
  ]
}
