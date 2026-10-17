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
  /** die gewählte Scheibe des Zeitraums: ihre Rekorde sind markiert und sagen „gezeigt“ */
  chosen?: string | null
  className?: string
}

/** so viele Rekorde aus dem Zeitraum stehen oben */
const NEW_RECORDS = 5

/**
 * Analyse über den Zeitraum: die Rekorde (R1–R8, R10, R11, in der Wertung und Art der Seite, über alle Scheiben der Familie).
 * Oben höchstens fünf, deren Scheibe im Zeitraum liegt, darunter zugeklappt alle; ein Rekord zeigt seine Scheibe, wenn
 * sie im Zeitraum liegt. Eine Karte „Gegen deinen Schnitt“ gibt es nicht: Den Abstand zum Schnitt der fünf davor sagt
 * die Ablesung.
 *
 * Die ganze Zeile ist der Knopf, mit Linien dazwischen wie in der Liste der Scheiben: Ein „zeigen“ allein am rechten
 * Rand ließ nicht erkennen, zu welchem Rekord es gehört. Die Rekorde der gewählten Scheibe sind
 * markiert.
 */
export function PeriodInsights({
  model,
  scoring,
  timeZone,
  explain,
  onHelp,
  onChoose,
  chosen = null,
  className,
}: PeriodInsightsProps) {
  const inPeriod = new Set(model.cards.map((c) => c.id))
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const rows = recordRows(model.records, scoring)
  const recent = rows.filter((row) => inPeriod.has(row.record.cardId)).slice(0, NEW_RECORDS)
  const row = (r: RecordRow) => {
    const here = inPeriod.has(r.record.cardId)
    const shown = r.record.cardId === chosen
    const text = (
      <span className="min-w-0">
        <span className="text-muted-foreground">{`${r.label}: `}</span>
        <span className="font-semibold tabular-nums">{r.value}</span>
        <span className="text-muted-foreground">
          {` · ${date(r.record.atMs)}${r.record.detail ? ` · ${r.record.detail}` : ""}`}
        </span>
      </span>
    )
    const line = "grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-2 py-1.5"
    return (
      <li key={r.key} data-record={r.key} data-record-card={r.record.cardId}>
        {here && onChoose ? (
          <button
            type="button"
            // kein `aria-pressed`: ein zweiter Klick nimmt die Wahl nicht zurück, er springt nur (wie `pick` in der Liste)
            aria-current={shown ? "true" : undefined}
            onClick={() => onChoose(r.record.cardId)}
            className={cn(
              line,
              "cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-ring",
              shown ? "bg-accent-wash" : "hover:bg-surface-2"
            )}
          >
            {text}
            <span
              className={cn(
                "text-[12.5px] font-semibold",
                shown ? "text-foreground-2" : "text-primary"
              )}
            >
              {shown ? "gezeigt" : "zeigen"}
            </span>
          </button>
        ) : (
          <div className={line}>
            {text}
            {here ? (
              <span />
            ) : (
              <span title="außerhalb des Zeitraums" className="text-[12.5px] text-muted-foreground">
                außerhalb<span className="sr-only"> des Zeitraums</span>
              </span>
            )}
          </div>
        )}
      </li>
    )
  }
  // Linien zwischen den Rekorden; die Zeilen reichen um ihren Innenabstand über den Rand, der Text bleibt bündig
  const list = "-mx-2 grid divide-y divide-border text-[13px]"
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
              <ul data-records-new className={list}>
                {recent.map(row)}
              </ul>
            ) : (
              <Note>Im Zeitraum kein neuer Rekord.</Note>
            )}
            <details data-all-records>
              <summary className="cursor-pointer text-[13px] font-semibold text-primary">
                {`Alle Rekorde (${rows.length})`}
              </summary>
              <ul data-records className={cn(list, "mt-2")}>
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
