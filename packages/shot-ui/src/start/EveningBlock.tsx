"use client"

import { inScoring, metricByKey, type Scoring } from "@vereinsheim/shot-core/metrics"
import type { MarkShot } from "@vereinsheim/shot-core/projection"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatTimeOfDay, formatWeekdayDay, zonedDayStartMs } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { Target } from "lucide-react"
import type { ReactNode } from "react"

import { quietProvenance } from "../detail"
import { formatValue } from "../format"
import { HelpButton } from "../help/HelpButton"
import type { ListRow } from "../list/evenings"
import { RouteLink } from "../nav/RouteLink"
import type { CardRoute, ListRoute } from "../nav/routes"
import { MiniTarget } from "../target/MiniTarget"
import { basisLine } from "../period/basis"
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
  /** öffnet die Erklärung „Grundlage und Herkunft“ an der Grundlage des Abends; ohne kein „?“ */
  onHelp?: (id: string) => void
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
  onHelp,
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
  // die Herkunft einer Scheibe des Abends leise, wie in der Liste
  const provenanceOf = (id: string) =>
    quietProvenance(block.rows.find((row) => row.id === id)?.provenance)
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
        {block.basis && (
          <p
            data-evening-basis
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground"
          >
            {basisLine(block.basis)}
            {onHelp && (
              <HelpButton
                label="Grundlage und Herkunft"
                helpId="grundlage"
                onClick={() => onHelp("grundlage")}
              />
            )}
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
          const reason = row.result === null ? (row.reasons?.[row.resultScoring] ?? null) : null
          const provenance = quietProvenance(row.provenance)
          return (
            // zwei Zeilen, die alle Kacheln einer Reihe teilen (Subgrid): Uhrzeit und Art, darunter das Ergebnis. Bricht
            // in einer Kachel ein Text um, rücken die Zeilen der anderen mit, die Ergebnisse stehen auf einer Linie
            <li key={row.id} className="row-span-2 grid grid-rows-subgrid">
              <RouteLink
                route={cardRoute(row.id)}
                data-start-card={row.id}
                aria-label={`Scheibe um ${time}, ${KIND[row.kind]}${provenance ? `, ${provenance}` : ""}, Ergebnis ${result}${row.result === null ? (reason ? ` (${reason})` : "") : ` ${name(row.resultScoring)}`}${second ? `, ${second}` : ""}`}
                className="row-span-2 grid grid-cols-[auto_minmax(0,1fr)] grid-rows-subgrid gap-x-3 gap-y-0.5 rounded-xl border border-line-strong p-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {/* ohne Lagen je Schuss die Scheibe leise, ohne Mitte wie die kleinen Scheiben gemessener Scheiben */}
                <MiniTarget
                  target={target}
                  shots={placed}
                  placeholder={!placed.length}
                  className="row-span-2 size-14 self-start"
                />
                <span data-start-meta className="text-[13px] text-muted-foreground">
                  {`${time} · ${KIND[row.kind]}${provenance ? ` · ${provenance}` : ""}`}
                </span>
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
                    {reason && (
                      <span className="text-[13px] text-muted-foreground">{` ${reason}`}</span>
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
                  {provenanceOf(row.record.cardId) && (
                    <span className="text-muted-foreground">{` · ${provenanceOf(row.record.cardId)}`}</span>
                  )}
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
