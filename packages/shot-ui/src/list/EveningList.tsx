"use client"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import {
  formatMonthYear,
  formatTimeOfDay,
  formatWeekdayDate,
  formatWeekdayDay,
  zonedDayStartMs,
} from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { groupView } from "../geometry"
import { hasPosition, matchShots } from "../shots"
import { RouteLink, shouldIntercept, useRouteNavigate } from "../nav/RouteLink"
import type { CardRoute, ListRoute } from "../nav/routes"
import { MiniTarget } from "../target/MiniTarget"
import { eveningsByMonth, type CardListModel, type ListRow } from "./evenings"

/** die Wertung im Namen der Zeile */
const SCORING_IN: Readonly<Record<Scoring, string>> = {
  decimal: "in Zehnteln",
  rings: "in ganzen Ringen",
}

const KIND: Readonly<Record<ListRow["kind"], { short: string; text: string }>> = {
  training: { short: "T", text: "Training" },
  competition: { short: "W", text: "Wettkampf" },
  probe: { short: "P", text: "Training nur Probe" },
}

/** auf dem Telefon ohne Uhrzeit, Abstand und Schusszahl; ab 32rem Breite der Liste (Container) mit (D5) */
const WIDE = "hidden @min-[32rem]:table-cell"
const CELL = "px-2 py-1"

/** die Schüsse der kleinen Scheibe: die Wertung, bei nur Probe die Probe wie Wertung, nur mit Lage */
const placedShots = (card: PeriodCard) => matchShots(card.shots).filter(hasPosition)

/** Mittag des Tages: das Datum eines Abends, unabhängig von der Zeitumstellung */
const noonOf = (day: string, timeZone: string) =>
  new Date(zonedDayStartMs(day, timeZone) + 12 * 3_600_000)

export interface EveningListProps {
  model: CardListModel
  /** die Scheiben nach Id, für die kleinen Scheiben */
  cards: ReadonlyMap<string, PeriodCard>
  /** das Scheibenbild der Familie */
  target: TargetImage
  /** Namen der Familien für den Hinweis auf andere Familien des Abends */
  families: readonly { value: string; label: string }[]
  timeZone: string
  /** die Adresse einer Scheibe aus dieser Liste (`openCard` mit der Liste als Herkunft); die ganze Zeile führt hin */
  cardRoute: (id: string) => CardRoute
  /** die Liste einer anderen Familie an diesem Abend (`listOnEvening`, D3) */
  otherFamilyRoute: (family: string, day: string) => ListRoute
  className?: string
}

/**
 * Scheiben-Liste nach Abend (Plan N2, D1–D6), im Stil der Liste eines Zeitraums: je Monat eine Karte mit Kopf und
 * einer Tabelle, je Abend eine Gruppe von Zeilen (das Datum steht einmal, die Scheiben in zeitlicher Folge), dazu
 * der Hinweis auf andere Familien des Abends. Die Gruppe trägt den ISO-Tag als Anker. Die ganze Zeile öffnet die
 * Scheibe; ihr Knopf ist die kleine Scheibe und trägt die Werte der Zeile als Namen.
 */
export function EveningList({
  model,
  cards,
  target,
  families,
  timeZone,
  cardRoute,
  otherFamilyRoute,
  className,
}: EveningListProps) {
  const go = useRouteNavigate()
  if (!model.evenings.length) {
    return (
      <p className={cn("text-[13px] text-muted-foreground", className)}>
        Keine Scheiben für diese Filter.
      </p>
    )
  }
  const nameOf = (family: string) => families.find((f) => f.value === family)?.label ?? family
  const { digits } = model
  const otherScoring = (row: ListRow): Scoring =>
    row.resultScoring === "rings" ? "decimal" : "rings"
  const resultText = (value: number | null, scoring: Scoring) =>
    value === null ? "–" : formatValue(value, digits.result[scoring])
  const rowName = (row: ListRow, day: string, time: string) =>
    [
      formatWeekdayDate(noonOf(day, timeZone), timeZone),
      time,
      KIND[row.kind].text,
      row.result === null
        ? "ohne Ergebnis"
        : `Ergebnis ${resultText(row.result, row.resultScoring)}${row.official ? " amtlich" : ""} ${SCORING_IN[row.resultScoring]}`,
      row.otherResult === null
        ? null
        : `${resultText(row.otherResult, otherScoring(row))} ${SCORING_IN[otherScoring(row)]}`,
      row.mean === null ? null : `Ø ${formatValue(row.mean, digits.mean)} je Schuss`,
      row.delta ? `${formatSigned(row.delta.delta, digits.mean)} zum Schnitt davor` : null,
      `${row.shots} Schuss`,
    ]
      .filter(Boolean)
      .join(", ")

  return (
    <div data-evening-list className={cn("@container grid gap-7", className)}>
      {eveningsByMonth(model.evenings).map((month) => {
        const title = formatMonthYear(noonOf(`${month.month}-15`, timeZone), timeZone)
        return (
          <section
            key={month.month}
            data-month={month.month}
            aria-labelledby={`month-${month.month}`}
            className="grid gap-2"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
              <h2
                id={`month-${month.month}`}
                className="font-display text-xl font-bold tracking-tight"
              >
                {title}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {`${month.cards} ${month.cards === 1 ? "Scheibe" : "Scheiben"} · ${month.shots} Schuss`}
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card p-2">
              <table className="w-full border-collapse text-[13px] tabular-nums">
                <caption className="sr-only">{`Scheiben im ${title} nach Abend, neueste zuerst`}</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className={cn(CELL, "py-1.5 text-left font-medium")}>
                      Datum
                    </th>
                    <th scope="col" className="w-10 py-1.5">
                      <span className="sr-only">Scheibe</span>
                    </th>
                    <th scope="col" className={cn(CELL, WIDE, "py-1.5 text-left font-medium")}>
                      Uhrzeit
                    </th>
                    <th scope="col" className="px-1 py-1.5 text-center font-medium">
                      Art
                    </th>
                    <th scope="col" className={cn(CELL, "py-1.5 text-left font-medium")}>
                      Ergebnis
                    </th>
                    <th scope="col" className={cn(CELL, "py-1.5 text-right font-medium")}>
                      Ø je Schuss
                    </th>
                    <th
                      scope="col"
                      title="Abstand zum Schnitt der bis zu fünf Scheiben davor"
                      className={cn(CELL, WIDE, "py-1.5 text-right font-medium")}
                    >
                      zum Schnitt
                    </th>
                    <th scope="col" className={cn(CELL, WIDE, "py-1.5 text-right font-medium")}>
                      Schuss
                    </th>
                  </tr>
                </thead>
                {month.evenings.map((evening) => {
                  return (
                    <tbody
                      key={evening.day}
                      id={evening.day}
                      data-evening={evening.day}
                      className="scroll-mt-14 border-t border-border"
                    >
                      {evening.rows.map((row, i) => {
                        const card = cards.get(row.id)
                        const placed = card ? placedShots(card) : []
                        const kind = KIND[row.kind]
                        const time = formatTimeOfDay(new Date(row.startedAtMs), timeZone)
                        return (
                          <tr
                            key={row.id}
                            data-card-row={row.id}
                            onClick={(event) => {
                              // der Link der kleinen Scheibe geht selbst; mit Strg, Cmd, Shift oder Alt bleibt die
                              // Zeile stehen (einen neuen Tab öffnet der Link, nicht die Zeile)
                              if ((event.target as Element).closest("a") || !shouldIntercept(event))
                                return
                              go(cardRoute(row.id))
                            }}
                            className="cursor-pointer hover:bg-surface-2"
                          >
                            {/* jede Zeile hat ihre Datumszelle (das Hervorheben bleibt ein Rechteck), das Datum
                                steht nur in der ersten des Abends (User, 9. Oktober 2026) */}
                            {i === 0 ? (
                              <th scope="row" className={cn(CELL, "text-left font-semibold")}>
                                {formatWeekdayDay(noonOf(evening.day, timeZone), timeZone)}
                              </th>
                            ) : (
                              <td className={CELL} />
                            )}
                            <td className="py-1">
                              <RouteLink
                                route={cardRoute(row.id)}
                                aria-label={rowName(row, evening.day, time)}
                                className="block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                {placed.length ? (
                                  <MiniTarget
                                    target={target}
                                    view={groupView(
                                      target,
                                      placed.map((s) => ({
                                        xUm: s.xUm as number,
                                        yUm: s.yUm as number,
                                      }))
                                    )}
                                    shots={placed}
                                    className="size-8"
                                  />
                                ) : (
                                  <span className="block size-8" aria-hidden="true" />
                                )}
                              </RouteLink>
                            </td>
                            <td className={cn(CELL, WIDE, "text-foreground-2")}>{time}</td>
                            <td
                              className="px-1 py-1 text-center text-muted-foreground"
                              title={kind.text}
                            >
                              {kind.short}
                            </td>
                            <td className={CELL}>
                              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                                <span data-result className="font-semibold">
                                  {resultText(row.result, row.resultScoring)}
                                </span>
                                {row.otherResult !== null && (
                                  <span data-other-result className="text-xs text-muted-foreground">
                                    {resultText(row.otherResult, otherScoring(row))}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td data-mean className={cn(CELL, "text-right")}>
                              {row.mean === null ? "–" : formatValue(row.mean, digits.mean)}
                            </td>
                            <td
                              data-delta
                              className={cn(CELL, WIDE, "text-right text-foreground-2")}
                            >
                              {row.delta ? formatSigned(row.delta.delta, digits.mean) : "–"}
                            </td>
                            <td className={cn(CELL, WIDE, "text-right text-muted-foreground")}>
                              {row.shots}
                            </td>
                          </tr>
                        )
                      })}
                      {evening.others.length > 0 && (
                        <tr>
                          <td colSpan={8} className="px-1 pb-1.5 text-right">
                            {evening.others.map((other) => (
                              <RouteLink
                                key={other.family}
                                route={otherFamilyRoute(other.family, evening.day)}
                                data-other-family={other.family}
                                className="inline-block cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                {`auch ${other.count} ${other.count === 1 ? "Scheibe" : "Scheiben"} ${nameOf(other.family)} ›`}
                              </RouteLink>
                            ))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  )
                })}
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
