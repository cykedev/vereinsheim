"use client"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { formatDateOnly } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { quietProvenance } from "../detail"
import { AnalysisCard, Note } from "../analysis/parts"
import type { PeriodModel } from "./model"
import { useHelpTexts } from "../help/HelpTexts"
import { usePeriodWords } from "./PeriodWords"
import { NEW_RECORDS, recordRows, type RecordRow } from "./records"

/** die Zeilen der Rekorde; liegen in `./records` (rein, ohne React), hier weiter für bestehende Aufrufer */
export { recordRows, type RecordRow } from "./records"

export interface PeriodInsightsProps {
  model: Pick<PeriodModel, "records" | "cards"> & Partial<Pick<PeriodModel, "recordProvenance">>
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
export function PeriodInsights({ className, ...props }: PeriodInsightsProps) {
  const words = usePeriodWords()
  return (
    <section aria-label="Analyse" className={cn("@container grid gap-4", className)}>
      <div className="grid min-w-0 gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Was der Zeitraum zeigt</h2>
        <p className="text-[13px] text-muted-foreground">{`Analyse über die ${words.many}`}</p>
      </div>
      <RecordsCard {...props} />
    </section>
  )
}

/** die Karte „Rekorde“ allein: in `PeriodInsights` und im Reiter „Ergebnis“ der Analyse über den Zeitraum */
export function RecordsCard({
  model,
  scoring,
  timeZone,
  explain,
  onHelp,
  onChoose,
  chosen = null,
}: Omit<PeriodInsightsProps, "className">) {
  const inPeriod = new Set(model.cards.map((c) => c.id))
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const words = usePeriodWords()
  const texts = useHelpTexts()
  const rows = recordRows(model.records, scoring, words)
  // die Herkunft leise wie in der Liste, nie „gemessen“
  const provenanceOf = (id: string) => quietProvenance(model.recordProvenance?.[id])
  const inRange = rows.filter((row) => inPeriod.has(row.record.cardId))
  const recent = inRange.slice(0, NEW_RECORDS)
  const row = (r: RecordRow) => {
    const here = inPeriod.has(r.record.cardId)
    const shown = r.record.cardId === chosen
    const text = (
      <span className="min-w-0">
        <span className="text-muted-foreground">{`${r.label}: `}</span>
        <span className="font-semibold tabular-nums">{r.value}</span>
        <span className="text-muted-foreground">
          {` · ${date(r.record.atMs)}${r.record.detail ? ` · ${r.record.detail}` : ""}`}
          {provenanceOf(r.record.cardId) && ` · ${provenanceOf(r.record.cardId)}`}
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
    <AnalysisCard help="rekorde" texts={texts} explain={explain} onHelp={onHelp}>
      {rows.length ? (
        <>
          {recent.length ? (
            <ul data-records-new className={list}>
              {recent.map(row)}
            </ul>
          ) : (
            <Note>Im Zeitraum kein neuer Rekord.</Note>
          )}
          {/* aufgeklappt, wenn oben nicht alle neuen stehen: Der Link „Noch N weitere …“ auf Start führt hierher */}
          <details data-all-records open={inRange.length > NEW_RECORDS}>
            <summary className="cursor-pointer text-[13px] font-semibold text-primary">
              {`Alle Rekorde (${rows.length})`}
            </summary>
            <ul data-records className={cn(list, "mt-2")}>
              {rows.map(row)}
            </ul>
          </details>
        </>
      ) : (
        <Note>{words.noRecords}</Note>
      )}
    </AnalysisCard>
  )
}
