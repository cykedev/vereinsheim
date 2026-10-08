"use client"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"
import { Fragment } from "react"

import { directionWords, formatValue } from "../format"
import { scoreColor } from "../geometry"
import type { ViewState } from "../view-state"
import { readoutModel, readoutValue } from "./readout"

/**
 * Ablesezeile (Plan Schritt 4, D2): auf dem Telefon unter der Scheibe statt der Ablese-Karte, eine Zeile
 * „Schuss 23 · 9,7 · Teiler 312,4 · 4,2 mm rechts und 1,1 mm tief“. Dieselben Werte wie die Karte; ein
 * Wechsel wird Screenreadern gemeldet.
 */
export function ShotLine({
  shots,
  state,
  className,
}: {
  shots: readonly MetricShot[]
  state: ViewState
  className?: string
}) {
  const model = readoutModel(shots, state)
  const parts = model
    ? [
        `${model.kindWord} ${model.label}`,
        readoutValue(model, state.scoring),
        model.teiler === null ? null : `Teiler ${formatValue(model.teiler, 1)}`,
        model.placed
          ? directionWords({ xUm: model.shot.xUm as number, yUm: model.shot.yUm as number })
          : null,
      ].filter((part): part is string => part !== null)
    : []
  return (
    <p
      aria-live="polite"
      aria-label="Ablesung"
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] text-foreground-2 tabular-nums",
        className
      )}
    >
      {model && model.shot.ring !== null && (
        <span
          aria-hidden="true"
          className="mr-0.5 inline-block size-3 shrink-0 rounded-full"
          style={
            model.shot.kind === "probe"
              ? { boxShadow: `inset 0 0 0 2px ${scoreColor(model.shot.ring)}` }
              : { background: scoreColor(model.shot.ring) }
          }
        />
      )}
      {model
        ? parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <span className={i === 1 ? "font-semibold text-foreground" : undefined}>{part}</span>
            </Fragment>
          ))
        : "Noch kein Schuss."}
    </p>
  )
}
