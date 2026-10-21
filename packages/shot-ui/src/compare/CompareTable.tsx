"use client"

import { cn } from "@vereinsheim/lib/utils"

import { formatValue, unitText } from "../format"
import { HelpButton } from "../help/HelpButton"
import { SIDE_COLORS } from "./ComparePicture"
import type { CompareModel, CompareRow } from "./model"
import { goldSide, missingReason, positionClear, positionValue, tableNote } from "./words"

/** Gold für den klar besseren Wert: getönt mit Rahmen, die Schrift bleibt in ihrer Farbe */
const GOLD = "rounded-md bg-gold-wash px-1.5 ring-1 ring-gold-line"
/** eine Zelle; die Linie trägt die ganze Zeile, damit sie zwischen den Spalten nicht abreißt */
const CELL = "py-2"
const NUMBER = "text-right font-display text-[15px] font-semibold tabular-nums"

/** die Erklärung der Tabelle: bei zwei Scheiben die des Schussvergleichs, sonst die der Zeiträume */
export const rowHelp = (model: Pick<CompareModel, "unit">) =>
  model.unit === "shot" ? "scheibe-vergleich" : "zeitraum-vergleich"

/**
 * eine Zahl ohne Einheit (die steht beim Namen der Zeile, so sind alle Zahlen gleich gebaut), in Gold, wenn sie klar
 * besser ist; ohne Wert „–“ mit Grund, für Screenreader und als Tooltip
 */
function Value({ row, value, gold }: { row: CompareRow; value: number | null; gold: boolean }) {
  if (value === null) {
    const reason = missingReason(row)
    return (
      <span title={reason} className="text-muted-foreground">
        –<span className="sr-only"> {reason}</span>
      </span>
    )
  }
  return (
    <span data-gold={gold || undefined} className={cn(gold && GOLD)}>
      {formatValue(value, row.decimals)}
      {gold && <span className="sr-only"> (klar besser)</span>}
    </span>
  )
}

/** Kopf einer Spalte: der kurze Name der Seite mit dem Punkt ihrer Farbe */
function Head({ side, name }: { side: "a" | "b"; name: string }) {
  return (
    <span className="flex items-center justify-end gap-1.5 pb-1.5 text-right text-[12px] leading-tight font-semibold [overflow-wrap:anywhere] text-foreground-2">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: SIDE_COLORS[side] }}
      />
      {name}
    </span>
  )
}

/**
 * Die Zahlen beider Seiten in einer Tabelle: alle Kacheln des Fortschritts und die Lage. Ø je Schuss und Streuung tragen
 * den Vergleich der Seite (bei zwei Scheiben Schuss für Schuss), die übrigen Zahlen bei Gruppen ihren je Scheibe. Ein
 * klar besserer Wert steht in Gold, die Regel dafür einmal unter der Tabelle; liegen die Mitten klar auseinander, der
 * Abstand. Die Spalten heißen nach den Seiten („6 Monate“, „davor“) und sind gleich breit; die Einheit steht beim Namen
 * der Zeile. Die Lage ist eine Zahl für beide Seiten und steht deshalb als eigene Zeile unter den Spalten.
 */
export function CompareTable({
  model,
  onHelp,
  className,
}: {
  model: CompareModel
  onHelp: (id: string) => void
  className?: string
}) {
  const help = rowHelp(model)
  const rows = model.metrics.map((row) =>
    row.key === model.result.key ? model.result : row.key === model.spread.key ? model.spread : row
  )
  const position = positionValue(model)
  const shifted = positionClear(model)
  return (
    <div data-compare-table className={cn("grid gap-2", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] items-baseline gap-x-4 rounded-2xl border border-border bg-card px-4 pt-3 pb-1">
        <span className="flex items-center gap-1 pb-1.5 text-[12px] font-semibold text-foreground-2">
          Zahlen
          <HelpButton
            label="Erklärung: Zahlen im Vergleich"
            helpId={help}
            onClick={() => onHelp(help)}
          />
        </span>
        <Head side="a" name={model.a.short} />
        <Head side="b" name={model.b.short} />
        {rows.map((row) => {
          const gold = goldSide(row)
          return (
            <div
              key={row.key}
              data-compare-row={row.key}
              className="col-span-3 grid grid-cols-subgrid border-t border-border"
            >
              <span className={cn(CELL, "text-[14px]")}>
                {row.label}
                {unitText(row.unit) && (
                  <span className="ml-1.5 text-[12px] text-muted-foreground">
                    {unitText(row.unit)}
                  </span>
                )}
              </span>
              <span className={cn(CELL, NUMBER)}>
                <Value row={row} value={row.a} gold={gold === "a"} />
              </span>
              <span className={cn(CELL, NUMBER)}>
                <Value row={row} value={row.b} gold={gold === "b"} />
              </span>
            </div>
          )
        })}
        <div
          data-compare-row="position"
          className="col-span-3 flex items-baseline justify-between gap-3 border-t border-border"
        >
          <span className={cn(CELL, "flex items-center gap-1 text-[14px]")}>
            Lage
            <HelpButton
              label="Lage"
              helpId="lage-vergleich"
              onClick={() => onHelp("lage-vergleich")}
            />
          </span>
          <span className={cn(CELL, "text-right text-[14px] font-semibold tabular-nums")}>
            {position ? (
              <span data-gold={shifted || undefined} className={cn(shifted && GOLD)}>
                {position}
                {shifted && <span className="sr-only"> (klar auseinander)</span>}
              </span>
            ) : (
              <span title="Ohne Lage der Schüsse." className="text-muted-foreground">
                –<span className="sr-only"> Ohne Lage der Schüsse.</span>
              </span>
            )}
          </span>
        </div>
      </div>
      <p data-compare-note className="text-[12.5px] text-muted-foreground">
        {tableNote(model)}
      </p>
    </div>
  )
}
