"use client"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { probeOnlyAsMatch, type Scoring } from "@vereinsheim/shot-core/metrics"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import { formatTimeOfDay, formatWeekdayDate, zonedDayStartMs } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { formatSigned, formatValue } from "../format"
import { groupView } from "../geometry"
import { isProbeOnly } from "../period/model"
import { hasPosition } from "../shots"
import { MiniTarget } from "../target/MiniTarget"
import type { CardListModel, ListRow } from "./evenings"

const KIND: Readonly<Record<ListRow["kind"], { short: string; text: string }>> = {
  training: { short: "T", text: "Training" },
  competition: { short: "W", text: "Wettkampf" },
  probe: { short: "P", text: "Training nur Probe" },
}

/** Spalten: auf dem Telefon kleine Scheibe, Art, Ergebnis, Ø; ab 32rem Breite dazu Uhrzeit, Abstand, Schuss (D5) */
const COLUMNS =
  "grid grid-cols-[2.5rem_1.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 @min-[32rem]:grid-cols-[2.5rem_3rem_1.5rem_minmax(0,1fr)_3.5rem_4rem_3rem]"
const WIDE = "hidden @min-[32rem]:block"

/** die Schüsse der kleinen Scheibe: die Wertung, bei nur Probe die Probe wie Wertung, nur mit Lage */
const placedShots = (card: PeriodCard) =>
  (isProbeOnly(card)
    ? probeOnlyAsMatch(card.shots)
    : card.shots.filter((s) => s.kind === "match")
  ).filter(hasPosition)

export interface EveningListProps {
  model: CardListModel
  /** die Scheiben nach Id, für die kleinen Scheiben */
  cards: ReadonlyMap<string, PeriodCard>
  /** das Scheibenbild der Familie */
  target: TargetImage
  /** Namen der Familien für den Hinweis auf andere Familien des Abends */
  families: readonly { value: string; label: string }[]
  scoring: Scoring
  timeZone: string
  /** die ganze Zeile öffnet die Scheibe (D6) */
  onOpen: (id: string) => void
  /** eine andere Familie desselben Abends zeigen (D3) */
  onFamily: (family: string, day: string) => void
  className?: string
}

/**
 * Scheiben-Liste nach Abend (Plan N2, D1–D6): je Abend ein Kopf mit Wochentag, Datum, Zahl der Scheiben und
 * Schüsse und dem Hinweis auf andere Familien, darunter alle Scheiben in zeitlicher Folge. Der Abend trägt seinen
 * ISO-Tag als Anker. Die ganze Zeile öffnet die Scheibe.
 */
export function EveningList({
  model,
  cards,
  target,
  families,
  scoring,
  timeZone,
  onOpen,
  onFamily,
  className,
}: EveningListProps) {
  if (!model.evenings.length) {
    return (
      <p className={cn("text-[13px] text-muted-foreground", className)}>
        Keine Scheiben für diese Filter.
      </p>
    )
  }
  const nameOf = (family: string) => families.find((f) => f.value === family)?.label ?? family
  const resultDigits = scoring === "rings" ? 0 : 1

  return (
    <div data-evening-list className={cn("@container grid gap-6", className)}>
      <div aria-hidden="true" className={cn(COLUMNS, "px-2 text-xs text-muted-foreground")}>
        <span />
        <span className={WIDE}>Uhrzeit</span>
        <span>Art</span>
        <span>Ergebnis</span>
        <span className="text-right">Ø</span>
        <span className={cn(WIDE, "text-right")}>zum Schnitt</span>
        <span className={cn(WIDE, "text-right")}>Schuss</span>
      </div>
      {model.evenings.map((evening) => (
        <section
          key={evening.day}
          id={evening.day}
          data-evening={evening.day}
          aria-labelledby={`${evening.day}-title`}
          className="grid scroll-mt-14 gap-1.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-2 pb-1.5">
            <h3 id={`${evening.day}-title`} className="text-[15px] font-semibold tracking-tight">
              {formatWeekdayDate(
                new Date(zonedDayStartMs(evening.day, timeZone) + 12 * 3_600_000),
                timeZone
              )}
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {`${evening.rows.length} ${evening.rows.length === 1 ? "Scheibe" : "Scheiben"} · ${evening.shots} Schuss`}
            </p>
            {evening.others.map((other) => (
              <button
                key={other.family}
                type="button"
                data-other-family={other.family}
                onClick={() => onFamily(other.family, evening.day)}
                className="cursor-pointer rounded-full px-2 py-0.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
              >
                {`auch ${other.count} ${other.count === 1 ? "Scheibe" : "Scheiben"} ${nameOf(other.family)} ›`}
              </button>
            ))}
          </div>
          <ol className="grid gap-0.5">
            {evening.rows.map((row) => {
              const card = cards.get(row.id)
              const placed = card ? placedShots(card) : []
              const kind = KIND[row.kind]
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    data-card-row={row.id}
                    onClick={() => onOpen(row.id)}
                    className={cn(
                      COLUMNS,
                      "w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[13px] tabular-nums hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                    )}
                  >
                    {placed.length ? (
                      <MiniTarget
                        target={target}
                        view={groupView(
                          target,
                          placed.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
                        )}
                        shots={placed}
                        className="size-10"
                      />
                    ) : (
                      <span className="size-10" aria-hidden="true" />
                    )}
                    <span className={cn(WIDE, "text-foreground-2")}>
                      {formatTimeOfDay(new Date(row.startedAtMs), timeZone)}
                    </span>
                    <span className="text-muted-foreground" title={kind.text}>
                      <span aria-hidden="true">{kind.short}</span>
                      <span className="sr-only">{kind.text}</span>
                    </span>
                    <span data-result className="font-semibold">
                      {row.result === null ? "–" : formatValue(row.result, resultDigits)}
                    </span>
                    <span data-mean className="text-right">
                      {row.mean === null ? "–" : formatValue(row.mean, 2)}
                    </span>
                    <span data-delta className={cn(WIDE, "text-right text-foreground-2")}>
                      {row.delta ? formatSigned(row.delta.delta, 2) : "–"}
                    </span>
                    <span className={cn(WIDE, "text-right text-muted-foreground")}>
                      {row.shots}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
