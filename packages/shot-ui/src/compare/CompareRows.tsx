"use client"

import { cn } from "@vereinsheim/lib/utils"

import { formatValue, unitText } from "../format"
import { HelpButton } from "../help/HelpButton"
import type { CompareModel, CompareRow } from "./model"
import { missingReason, positionValue, positionVerdict, rowVerdict } from "./words"
import { SIDE_COLORS } from "./ComparePicture"

/** ein Wert mit Einheit; ohne Wert „–“ mit Grund, für Screenreader und als Tooltip */
function Value({ row, value }: { row: CompareRow; value: number | null }) {
  if (value === null) {
    const reason = missingReason(row)
    return (
      <span title={reason} className="text-muted-foreground">
        –<span className="sr-only"> {reason}</span>
      </span>
    )
  }
  const unit = unitText(row.unit)
  return (
    <span>
      {formatValue(value, row.decimals)}
      {unit && <small className="ml-1 font-sans text-[12px] text-muted-foreground">{unit}</small>}
    </span>
  )
}

const NUMBER = "font-display text-[15px] font-bold tabular-nums text-right"

/** die Erklärung einer Zeile: bei zwei Scheiben die des Schussvergleichs, sonst die der Zeiträume */
export const rowHelp = (model: Pick<CompareModel, "unit">) =>
  model.unit === "shot" ? "scheibe-vergleich" : "zeitraum-vergleich"

/**
 * Die Belege unter dem Bild: Ø je Schuss, Streuung und Lage, je A und B in den Farben der Seiten und darunter das
 * Urteil in Worten. Die Lage hat einen Wert für beide: den Abstand der Mitten.
 */
export function CompareRows({
  model,
  onHelp,
  className,
}: {
  model: CompareModel
  onHelp: (id: string) => void
  className?: string
}) {
  const help = rowHelp(model)
  const position = positionValue(model)
  return (
    <div
      data-compare-rows
      className={cn("grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1", className)}
    >
      <span />
      {(["a", "b"] as const).map((side) => (
        <span key={side} className="flex items-center justify-end gap-1 text-[12px] font-semibold">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ background: SIDE_COLORS[side] }}
          />
          {side.toUpperCase()}
        </span>
      ))}
      {[model.result, model.spread].map((row) => (
        <div key={row.key} data-compare-row={row.key} className="col-span-3 grid grid-cols-subgrid">
          <span className="flex items-center gap-1 text-[14px]">
            {row.label}
            <HelpButton label={row.label} helpId={help} onClick={() => onHelp(help)} />
          </span>
          <span className={NUMBER}>
            <Value row={row} value={row.a} />
          </span>
          <span className={NUMBER}>
            <Value row={row} value={row.b} />
          </span>
          <span
            data-compare-verdict
            className="col-span-3 -mt-0.5 mb-1.5 text-[12.5px] text-foreground-2"
          >
            {rowVerdict(row, model)}
          </span>
        </div>
      ))}
      <div data-compare-row="position" className="col-span-3 grid grid-cols-subgrid">
        <span className="flex items-center gap-1 text-[14px]">
          Lage
          <HelpButton
            label="Lage"
            helpId="lage-vergleich"
            onClick={() => onHelp("lage-vergleich")}
          />
        </span>
        <span className={cn(NUMBER, "col-span-2")}>
          {position ?? (
            <span title="Ohne Lage der Schüsse." className="text-muted-foreground">
              –<span className="sr-only"> Ohne Lage der Schüsse.</span>
            </span>
          )}
        </span>
        <span data-compare-verdict className="col-span-3 -mt-0.5 text-[12.5px] text-foreground-2">
          {positionVerdict(model)}
        </span>
      </div>
    </div>
  )
}

/**
 * Werkzeug: alle Kennzahlen des Fortschritts für A und B, eingeklappt. Gruppen mit Urteil je Zeile; bei zwei Scheiben
 * nur die Werte, denn für diese Zahlen gibt es keinen Test über Schüsse.
 */
export function CompareMetrics({
  model,
  onHelp,
}: {
  model: CompareModel
  onHelp: (metricKey: string) => void
}) {
  return (
    <details data-compare-metrics className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-ring">
        Alle Kennzahlen
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1 px-4 pb-4">
        {model.metrics.map((row) => (
          <div
            key={row.key}
            data-compare-metric={row.key}
            className="col-span-3 grid grid-cols-subgrid"
          >
            <span className="flex items-center gap-1 text-[14px]">
              {row.label}
              <HelpButton label={row.label} onClick={() => onHelp(row.key)} />
            </span>
            <span className={NUMBER}>
              <Value row={row} value={row.a} />
            </span>
            <span className={NUMBER}>
              <Value row={row} value={row.b} />
            </span>
            {model.unit === "card" && (
              <span className="col-span-3 -mt-0.5 mb-1.5 text-[12.5px] text-foreground-2">
                {rowVerdict(row, model)}
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}
