"use client"

import { inScoring, metricByKey, type Scoring } from "@vereinsheim/shot-core/metrics"
import type { MarkShot } from "@vereinsheim/shot-core/projection"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatTimeOfDay, formatWeekdayDay, zonedDayStartMs } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { Target } from "lucide-react"
import type { ReactNode } from "react"

import { formatValue } from "../format"
import { groupView } from "../geometry"
import type { ListRow } from "../list/evenings"
import { RouteLink } from "../nav/RouteLink"
import type { CardRoute, ListRoute } from "../nav/routes"
import { MiniTarget } from "../target/MiniTarget"
import { FormStrip } from "./FormStrip"
import type { EveningBlock as EveningBlockModel } from "./model"
import { eveningReferenceText, eveningSentence, formLegend } from "./sentence"

const KIND: Readonly<Record<ListRow["kind"], string>> = {
  training: "Training",
  competition: "Wettkampf",
  probe: "Training nur Probe",
}

/** Stellen des Ergebnisses in einer Wertung, aus der Kennzahl */
const digits = (scoring: Scoring) => inScoring(metricByKey("result.decimal")!, scoring).decimals
const other = (scoring: Scoring): Scoring => (scoring === "rings" ? "decimal" : "rings")
/** die Wertung des Blocks an der großen Zahl: Blöcke verschiedener Familien können verschieden rechnen */
const SCORING_IN: Readonly<Record<Scoring, string>> = {
  decimal: "in Zehnteln",
  rings: "in ganzen Ringen",
}

export interface EveningBlockProps {
  block: EveningBlockModel
  familyLabel: string
  /** die Lagen nach Id, für die kleinen Scheiben (`markShots(cardMarks(…))`); ohne Eintrag bleibt der Platz leer */
  marks: ReadonlyMap<string, readonly MarkShot[]>
  /** das Scheibenbild der Familie */
  target: TargetImage
  timeZone: string
  /** die Adresse einer Scheibe von Start (`openCard({ page: "start" }, …)`); sie öffnet in ihrer Wertung */
  cardRoute: (id: string) => CardRoute
  /** die Adresse der Scheibe eines Rekords, in der Wertung, in der der Rekord steht (die des Blocks) */
  recordRoute: (id: string, scoring: Scoring) => CardRoute
  /** die Liste dieser Familie mit dem Abend als Anker */
  listRoute: ListRoute
  /** Kreise rechts neben der großen Zahl: die Wertung der Familie */
  actions?: ReactNode
  /** ein Hinweis unten, etwa ein Fehler beim Speichern */
  notice?: ReactNode
  className?: string
}

/**
 * Der letzte Abend einer Familie auf Start: der Satz, Tag und Umfang,
 * der Ø je Schuss des Abends groß mit dem Abstand zum Schnitt, der Streifen im Formband, die Scheiben als Kacheln,
 * neue Rekorde und der Weg in die Liste. Weder die Seite einer Scheibe noch die Liste: die Details liegen einen
 * Tipp weiter.
 */
export function EveningBlock({
  block,
  familyLabel,
  marks,
  target,
  timeZone,
  cardRoute,
  recordRoute,
  listRoute,
  actions,
  notice,
  className,
}: EveningBlockProps) {
  const titleId = `evening-${block.family}`
  const metaId = `evening-${block.family}-meta`
  const date = formatWeekdayDay(
    new Date(zonedDayStartMs(block.day, timeZone) + 12 * 3_600_000),
    timeZone
  )
  const count = block.rows.length
  const sentence = eveningSentence(block, familyLabel)
  const reference = eveningReferenceText(block)
  const legend = formLegend(block)
  return (
    <section
      data-evening-block={block.family}
      aria-labelledby={`${titleId} ${metaId}`}
      className={cn("grid gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5", className)}
    >
      {/* die Disziplin als Überschrift oben: bei einem Mischabend unterscheiden sich die Blöcke auf einen Blick;
          Symbol der Disziplinen wie conventions §4 */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id={titleId}
          className="inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight"
        >
          <Target aria-hidden="true" className="size-[18px] shrink-0 self-center text-primary" />
          {familyLabel}
        </h2>
        <p id={metaId} className="text-[13px] text-muted-foreground tabular-nums">
          {`${date} · ${count} ${count === 1 ? "Scheibe" : "Scheiben"} · ${block.shots} Schuss`}
        </p>
      </div>
      {sentence && (
        <p
          data-evening-sentence
          className="font-display text-[1.45rem] leading-tight font-bold tracking-tight text-balance"
        >
          {sentence}
        </p>
      )}
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span
              data-evening-mean
              className="font-display text-[2.6rem] leading-none font-bold tracking-tight tabular-nums"
            >
              {block.mean === null ? "–" : formatValue(block.mean, 2)}
            </span>
            {/* mit Kreis nennt der Kreis die Wertung, ohne der Text */}
            <span className="text-[14px] text-muted-foreground">
              {actions ? "Ø je Schuss" : `Ø je Schuss ${SCORING_IN[block.scoring]}`}
            </span>
          </p>
          {actions && (
            <div data-evening-actions className="ml-auto flex shrink-0 items-center gap-1.5">
              {actions}
            </div>
          )}
        </div>
        {reference && (
          <p data-evening-reference className="text-[14px] text-foreground-2 tabular-nums">
            {reference}
          </p>
        )}
        {/* der Hinweis zum Kreis gleich darunter, nicht am Ende des Blocks */}
        {notice}
      </div>
      <div className="grid gap-1.5">
        <FormStrip strip={block.strip} band={block.band} dateLabel={date} />
        {/* was der Verlauf zeigt, nur was zu sehen ist; die Rechnung steht im Blatt „?“ */}
        {legend && (
          <p data-form-legend className="text-[13px] text-muted-foreground">
            {legend}
          </p>
        )}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-2">
        {block.rows.map((row) => {
          const placed = marks.get(row.id) ?? []
          const time = formatTimeOfDay(new Date(row.startedAtMs), timeZone)
          // die Wertung beim Namen: vorn die der Scheibe (ohne sie die amtliche), daneben die andere
          const name = (scoring: typeof row.resultScoring) =>
            scoring === "rings" ? "ganze Ringe" : "Zehntel"
          const result =
            row.result === null ? "–" : formatValue(row.result, digits(row.resultScoring))
          const second =
            row.otherResult === null
              ? null
              : `${formatValue(row.otherResult, digits(other(row.resultScoring)))} ${name(other(row.resultScoring))}`
          return (
            <li key={row.id}>
              {/* Kacheln einer Zeile gleich hoch, die kleine Scheibe oben: bricht in einer der Text um, steht ihre
                  Scheibe trotzdem auf der Höhe der anderen */}
              <RouteLink
                route={cardRoute(row.id)}
                data-start-card={row.id}
                aria-label={`Scheibe um ${time}, ${KIND[row.kind]}, Ergebnis ${result}${row.result === null ? "" : ` ${name(row.resultScoring)}`}${second ? `, ${second}` : ""}`}
                className="flex h-full items-start gap-3 rounded-xl border border-line-strong p-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {placed.length ? (
                  <MiniTarget
                    target={target}
                    view={groupView(target, placed)}
                    shots={placed}
                    className="size-14 shrink-0"
                  />
                ) : (
                  <span aria-hidden="true" className="block size-14 shrink-0" />
                )}
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-[13px] text-muted-foreground">{`${time} · ${KIND[row.kind]}`}</span>
                  {/* umbrechen nur zwischen den Wertungen, jede bleibt beisammen (kein „ganze / Ringe“) */}
                  <span
                    data-start-result
                    className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums"
                  >
                    <span className="whitespace-nowrap">
                      <span data-result className="text-[17px] font-semibold">
                        {result}
                      </span>
                      {row.result !== null && (
                        <span className="text-[13px] text-muted-foreground">
                          {` ${name(row.resultScoring)}`}
                        </span>
                      )}
                    </span>
                    {second && (
                      <span
                        data-other-result
                        className="text-xs whitespace-nowrap text-muted-foreground"
                      >
                        {`· ${second}`}
                      </span>
                    )}
                  </span>
                </span>
              </RouteLink>
            </li>
          )
        })}
      </ul>
      {block.records.length > 0 && (
        <div data-new-records className="grid gap-1.5">
          <h3 className="text-[13px] font-semibold">Neue Rekorde</h3>
          <ul className="grid gap-1 text-[13px]">
            {block.records.map((row) => (
              <li key={row.key} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-foreground-2">
                  {`${row.label}: `}
                  <span className="font-semibold text-foreground tabular-nums">{row.value}</span>
                </span>
                <RouteLink
                  route={recordRoute(row.record.cardId, block.scoring)}
                  aria-label={`${row.label}: ${row.value} zeigen`}
                  className="shrink-0 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  zeigen
                </RouteLink>
              </li>
            ))}
          </ul>
          {block.moreRecords > 0 && (
            <RouteLink
              route={block.recordsRoute}
              data-more-records
              className="justify-self-start text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {block.moreRecords === 1
                ? "Noch 1 weiterer Rekord im Fortschritt ›"
                : `Noch ${block.moreRecords} weitere Rekorde im Fortschritt ›`}
            </RouteLink>
          )}
        </div>
      )}
      <RouteLink
        route={listRoute}
        data-evening-list-link
        className="justify-self-start text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Abend in Scheiben ›
      </RouteLink>
    </section>
  )
}
