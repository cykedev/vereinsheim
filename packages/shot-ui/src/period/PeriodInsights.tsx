import type { RecordRef } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { formatDateOnly } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { AnalysisCard, KeyValues, Note } from "../analysis/parts"
import { formatSigned, formatValue, percentText } from "../format"
import type { PeriodModel } from "./model"

export interface PeriodInsightsProps {
  model: Pick<PeriodModel, "ownAverage" | "records" | "cards">
  scoring: Scoring
  timeZone: string
  explain: boolean
  onHelp?: (id: string) => void
  /** ein Rekord wählt seine Scheibe, wenn sie im Zeitraum liegt */
  onChoose?: (id: string) => void
  className?: string
}

interface RecordRow {
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
    ...perKey(records.bestCard, (k) => `Ergebnis, ${k} Schuss`, rings, "R1"),
    ...perKey(records.bestSeries, (k) => `beste Serie zu ${k}`, rings, "R2"),
    ...one(records.bestTeiler, "R3", "bester Teiler", (r) => formatValue(r.value, 1)),
    ...one(
      records.tightestSeries,
      "R4s",
      "engste Serie zu 10 (Streukreis)",
      (r) => `${formatValue(r.value, 1)} mm`
    ),
    ...perKey(
      records.tightestCard,
      (k) => `engste Scheibe, ${k} Schuss`,
      (r) => `${formatValue(r.value, 1)} mm`,
      "R4"
    ),
    ...perKey(records.mostPerfect, (k) => `meiste 10,9, ${k} Schuss`, count, "R5"),
    ...perKey(records.mostTens, (k) => `meiste Zehner, ${k} Schuss`, count, "R6z"),
    ...perKey(records.mostInnerTens, (k) => `meiste Innenzehner, ${k} Schuss`, count, "R6i"),
    ...one(records.longestTenRun, "R7", "längste Zehnerfolge", (r) => `${r.value} Schuss`),
    ...one(records.bestForm, "R8", "beste Form (Ø über fünf Scheiben)", (r) =>
      formatValue(r.value, 2)
    ),
  ]
}

/**
 * Analyse über den Zeitraum in L3 (Plan, D12): „Gegen deinen Schnitt“ (C4, im Ø je Schuss) und „Rekorde“ (R1–R8, in
 * der Wertung und Art der Seite, über alle Scheiben der Familie). Ein Rekord zeigt seine Scheibe, wenn sie im
 * Zeitraum liegt. Weitere Reiter kommen mit L4 und L5.
 */
export function PeriodInsights({
  model,
  scoring,
  timeZone,
  explain,
  onHelp,
  onChoose,
  className,
}: PeriodInsightsProps) {
  const own = model.ownAverage
  const inPeriod = new Set(model.cards.map((c) => c.id))
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const rows = recordRows(model.records, scoring)
  return (
    <section aria-label="Analyse" className={cn("@container grid gap-4", className)}>
      <div className="grid min-w-0 gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Was der Zeitraum zeigt</h2>
        <p className="text-[13px] text-muted-foreground">Analyse über die Scheiben</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[820px]:grid-cols-2">
        <AnalysisCard help="gegen-den-schnitt" explain={explain} onHelp={onHelp}>
          {own ? (
            <KeyValues
              rows={[
                ["Neueste Scheibe", `${formatValue(own.last.value, 2)} am ${date(own.last.atMs)}`],
                [
                  "Schnitt der 30 Tage davor",
                  own.average
                    ? `${formatValue(own.average.mean, 2)} (${own.average.n} Scheiben)`
                    : "ab 3 Scheiben in den 30 Tagen davor",
                ],
                own.average && ["Abstand", formatSigned(own.average.delta, 2)],
                own.percentile === null
                  ? ["Platz unter deinen letzten 50", "ab 10 Scheiben"]
                  : [`Platz unter deinen letzten ${own.pool}`, percentText(own.percentile)],
              ]}
            />
          ) : (
            <Note>Keine Scheibe im Zeitraum.</Note>
          )}
          <Note>
            Im Ø je Schuss, über alle deine Scheiben, nicht nur im Zeitraum: der Schnitt über die 30
            Tage davor, der Platz unter den letzten 50.
          </Note>
        </AnalysisCard>
        <AnalysisCard help="rekorde" explain={explain} onHelp={onHelp}>
          {rows.length ? (
            <ul data-records className="grid gap-1.5 text-[13px]">
              {rows.map((row) => {
                const here = inPeriod.has(row.record.cardId)
                return (
                  <li
                    key={row.key}
                    data-record={row.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3"
                  >
                    <span className="min-w-0">
                      <span className="text-muted-foreground">{row.label}</span>{" "}
                      <span className="font-semibold tabular-nums">{row.value}</span>
                      <span className="text-muted-foreground">
                        {` · ${date(row.record.atMs)}${row.record.detail ? ` · ${row.record.detail}` : ""}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={
                        here
                          ? `${row.label} vom ${date(row.record.atMs)} zeigen`
                          : `${row.label} vom ${date(row.record.atMs)}: außerhalb des Zeitraums`
                      }
                      disabled={!here || !onChoose}
                      title={here ? undefined : "außerhalb des Zeitraums"}
                      onClick={() => onChoose?.(row.record.cardId)}
                      className="cursor-pointer rounded text-[12.5px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                    >
                      {here ? "zeigen" : "außerhalb"}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Note>Noch kein Rekord: Es zählen nur abgeschlossene, vollständige Scheiben.</Note>
          )}
        </AnalysisCard>
      </div>
    </section>
  )
}
