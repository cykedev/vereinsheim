import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { formatDateOnly } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { AnalysisCard, Note } from "../analysis/parts"
import type { PeriodModel } from "./model"
import { recordRows, type RecordRow } from "./records"

/** die Zeilen der Rekorde; liegen in `./records` (rein, ohne React), hier weiter für bestehende Aufrufer */
export { recordRows, type RecordRow } from "./records"

export interface PeriodInsightsProps {
  model: Pick<PeriodModel, "records" | "cards">
  scoring: Scoring
  timeZone: string
  explain: boolean
  onHelp?: (id: string) => void
  /** ein Rekord wählt seine Scheibe, wenn sie im Zeitraum liegt */
  onChoose?: (id: string) => void
  className?: string
}

/** so viele Rekorde aus dem Zeitraum stehen oben (U2, D5) */
const NEW_RECORDS = 5

/**
 * Analyse über den Zeitraum (Plan L3, D12; U2): die Rekorde (R1–R8, in der Wertung und Art der Seite, über alle
 * Scheiben der Familie). Oben höchstens fünf, deren Scheibe im Zeitraum liegt, darunter zugeklappt alle; ein Rekord
 * zeigt seine Scheibe, wenn sie im Zeitraum liegt. „Gegen deinen Schnitt“ entfiel mit U2 (D2): Den Abstand zum Schnitt
 * der fünf davor sagt die Ablesung.
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
  const inPeriod = new Set(model.cards.map((c) => c.id))
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const rows = recordRows(model.records, scoring)
  const recent = rows.filter((row) => inPeriod.has(row.record.cardId)).slice(0, NEW_RECORDS)
  const row = (r: RecordRow) => {
    const here = inPeriod.has(r.record.cardId)
    return (
      <li
        key={r.key}
        data-record={r.key}
        data-record-card={r.record.cardId}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3"
      >
        <span className="min-w-0">
          <span className="text-muted-foreground">{r.label}</span>{" "}
          <span className="font-semibold tabular-nums">{r.value}</span>
          <span className="text-muted-foreground">
            {` · ${date(r.record.atMs)}${r.record.detail ? ` · ${r.record.detail}` : ""}`}
          </span>
        </span>
        <button
          type="button"
          aria-label={
            here
              ? `${r.label} vom ${date(r.record.atMs)} zeigen`
              : `${r.label} vom ${date(r.record.atMs)}: außerhalb des Zeitraums`
          }
          disabled={!here || !onChoose}
          title={here ? undefined : "außerhalb des Zeitraums"}
          onClick={() => onChoose?.(r.record.cardId)}
          className="cursor-pointer rounded text-[12.5px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
        >
          {here ? "zeigen" : "außerhalb"}
        </button>
      </li>
    )
  }
  return (
    <section aria-label="Analyse" className={cn("@container grid gap-4", className)}>
      <div className="grid min-w-0 gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Was der Zeitraum zeigt</h2>
        <p className="text-[13px] text-muted-foreground">Analyse über die Scheiben</p>
      </div>
      <AnalysisCard help="rekorde" explain={explain} onHelp={onHelp}>
        {rows.length ? (
          <>
            {recent.length ? (
              <ul data-records-new className="grid gap-1.5 text-[13px]">
                {recent.map(row)}
              </ul>
            ) : (
              <Note>Im Zeitraum kein neuer Rekord.</Note>
            )}
            <details data-all-records>
              <summary className="cursor-pointer text-[13px] font-semibold text-primary">
                {`Alle Rekorde (${rows.length})`}
              </summary>
              <ul data-records className="mt-2 grid gap-1.5 text-[13px]">
                {rows.map(row)}
              </ul>
            </details>
          </>
        ) : (
          <Note>Noch kein Rekord: Es zählen nur abgeschlossene, vollständige Scheiben.</Note>
        )}
      </AnalysisCard>
    </section>
  )
}
