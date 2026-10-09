"use client"

import type { CardValue, PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { formatShortDate } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { useId, useMemo, useState } from "react"

import { formatSigned, formatValue } from "../format"
import { RouteLink } from "../nav/RouteLink"
import type { ListRoute } from "../nav/routes"
import { KindMark } from "../list/KindMark"
import { cardKind, isProbeOnly } from "./model"

export interface CardListProps {
  /** Scheiben des Zeitraums in ihrer Folge (älteste zuerst) */
  cards: readonly PeriodCard[]
  /** Werte der Kennzahl des Verlaufs */
  values: readonly CardValue[]
  /** Abstand zum Schnitt der Scheiben davor (`PeriodModel.deltas`) */
  deltas: ReadonlyMap<string, { delta: number; n: number }>
  metric: Readonly<MetricDefinition>
  timeZone: string
  chosen: string | null
  onChoose?: (id: string) => void
  /** auf dem Telefon so viele Zeilen, bis „Alle zeigen“ */
  collapseAfter?: number
  /** „Alle in Scheiben zeigen“: die Scheiben-Liste mit Familie, Art und Zeitraum (Plan N2, D8; `listFromProgress`) */
  showAll?: ListRoute
  className?: string
}

/**
 * Liste der Scheiben eines Zeitraums (Plan L3, D10): neueste oben, je Zeile Datum, Art, Wert der Kennzahl, Abstand
 * zum Schnitt der bis zu fünf Scheiben davor und Schusszahl. Die Zeile wählt die Scheibe (der Knopf in der ersten
 * Zelle ist der Weg per Tastatur); auf dem Telefon die neuesten zehn und die gewählte, bis „Alle zeigen“.
 */
export function CardList({
  cards,
  values,
  deltas,
  metric,
  timeZone,
  chosen,
  onChoose,
  collapseAfter = 10,
  showAll,
  className,
}: CardListProps) {
  const [expanded, setExpanded] = useState(false)
  const tableId = useId()
  const byId = useMemo(() => new Map(values.map((v) => [v.id, v])), [values])
  const rows = [...cards].reverse()
  const shown = new Set(rows.slice(0, collapseAfter).map((c) => c.id))
  const collapsed = (id: string) => !expanded && !shown.has(id) && chosen !== id

  if (!rows.length) {
    return (
      <p className={cn("text-[13px] text-muted-foreground", className)}>
        Keine Scheibe im Zeitraum.
      </p>
    )
  }

  return (
    <div className={cn("overflow-auto", className)}>
      <table id={tableId} className="w-full border-collapse text-[13px] tabular-nums">
        <caption className="sr-only">{`Scheiben, neueste zuerst, mit ${metric.label}`}</caption>
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-1.5 text-left font-medium">
              Datum
            </th>
            <th scope="col" className="px-1 py-1.5 text-center font-medium">
              Art
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              {metric.label}
            </th>
            <th
              scope="col"
              title="Abstand zum Schnitt der bis zu fünf Scheiben davor"
              className="px-2 py-1.5 text-right font-medium"
            >
              zum Schnitt
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Schuss
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((card) => {
            const value = byId.get(card.id)
            const delta = deltas.get(card.id)
            const picked = chosen === card.id
            const date = formatShortDate(new Date(card.startedAtMs), timeZone)
            const choose = onChoose ? () => onChoose(card.id) : undefined
            const count = isProbeOnly(card)
              ? card.shots.length
              : card.shots.filter((s) => s.kind === "match").length
            return (
              <tr
                key={card.id}
                data-card-row={card.id}
                data-chosen={picked || undefined}
                onClick={choose}
                className={cn(
                  "border-t border-border",
                  choose && "cursor-pointer hover:bg-surface-2",
                  picked && "bg-accent-wash",
                  collapsed(card.id) && "max-md:hidden"
                )}
              >
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    aria-pressed={picked}
                    aria-label={`Scheibe vom ${date} wählen`}
                    onClick={(event) => {
                      // die Zeile wählt sonst ein zweites Mal
                      event.stopPropagation()
                      choose?.()
                    }}
                    className="-mx-1 cursor-pointer rounded px-1 font-semibold focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {date}
                  </button>
                </td>
                <td className="px-1 py-1.5 text-center text-muted-foreground">
                  <KindMark kind={cardKind(card)} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  {value ? formatValue(value.value, metric.decimals) : "–"}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground-2">
                  {value ? (delta ? formatSigned(delta.delta, metric.decimals) : "–") : "ohne Wert"}
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > collapseAfter && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={tableId}
          onClick={(event) => {
            const button = event.currentTarget
            setExpanded(!expanded)
            // beim Zuklappen verschwinden Zeilen über dem Knopf: ihn im Bild halten (Safari verankert nicht)
            if (expanded) requestAnimationFrame(() => button.scrollIntoView({ block: "nearest" }))
          }}
          className="mt-1 w-full cursor-pointer rounded-lg px-2 py-2 text-[13px] font-semibold text-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring md:hidden"
        >
          {expanded ? "Weniger zeigen" : `Alle ${rows.length} zeigen`}
        </button>
      )}
      {showAll && (
        <RouteLink
          route={showAll}
          data-show-all
          className="mt-1 block w-full cursor-pointer rounded-lg px-2 py-2 text-center text-[13px] font-semibold text-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Alle in Scheiben zeigen
        </RouteLink>
      )}
    </div>
  )
}
