"use client"

import { ChevronDown, ChevronRight, Plus } from "lucide-react"

import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"

import {
  emptyRow,
  seriesSumText,
  toggleRow,
  type FormDiscipline,
  type SeriesRow,
  type ValueMode,
} from "@/lib/entered/form"

const errorProps = (id: string, message: string | undefined) =>
  message ? { "aria-invalid": true as const, "aria-describedby": id } : {}

/**
 * Serien im Formular „Ergebnis eintragen“: je Serie eine Summe, darunter aufklappbar „Schüsse einzeln“ (dann kommt die
 * Summe aus den Schüssen und ist gesperrt). Am Ende „Serie hinzufügen“, eine leere letzte Serie lässt sich entfernen.
 */
export function SeriesRows({
  rows,
  mode,
  discipline,
  disabled,
  errorOf,
  onChange,
}: {
  rows: SeriesRow[]
  mode: ValueMode
  discipline: FormDiscipline
  disabled: boolean
  errorOf: (field: string) => string | undefined
  onChange: (rows: SeriesRow[]) => void
}) {
  const set = (i: number, row: SeriesRow) => onChange(rows.map((r, j) => (j === i ? row : r)))
  const last = rows[rows.length - 1]
  const lastEmpty =
    rows.length > 1 && last !== undefined && !last.sum.trim() && last.shots.every((s) => !s.trim())
  return (
    <div className="grid gap-3" data-entered-series>
      {rows.map((row, i) => {
        const sumId = `series-${i}-sum`
        const sumError = errorOf(`series.${i}.sum`)
        const computed = row.open ? seriesSumText(row, mode) : null
        return (
          <div key={i} className="grid gap-2" data-entered-row={i + 1}>
            <div className="flex items-center gap-3">
              <label htmlFor={sumId} className="min-w-16 text-sm font-semibold">
                Serie {i + 1}
              </label>
              <Input
                id={sumId}
                inputMode="decimal"
                autoComplete="off"
                className="w-28 tabular-nums"
                value={row.open ? (computed ?? "") : row.sum}
                readOnly={row.open}
                disabled={disabled}
                onChange={(e) => set(i, { ...row, sum: e.target.value })}
                {...errorProps(`${sumId}-error`, sumError)}
              />
              {row.open && (
                <span className="text-[13px] text-muted-foreground">aus den Schüssen</span>
              )}
            </div>
            <FieldError id={`${sumId}-error`} message={sumError} />
            <div>
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-2 text-[13px]"
                aria-expanded={row.open}
                aria-controls={`series-${i}-shots`}
                disabled={disabled}
                onClick={() => set(i, toggleRow(row, mode, discipline))}
              >
                {row.open ? (
                  <ChevronDown aria-hidden className="size-4" />
                ) : (
                  <ChevronRight aria-hidden className="size-4" />
                )}
                Schüsse einzeln
              </Button>
            </div>
            {row.open && (
              <div id={`series-${i}-shots`} className="grid grid-cols-5 gap-2">
                {row.shots.map((shot, j) => {
                  const shotId = `series-${i}-shot-${j}`
                  const shotError = errorOf(`series.${i}.shot.${j}`)
                  return (
                    <div key={j} className="grid gap-1">
                      <Input
                        id={shotId}
                        inputMode="decimal"
                        autoComplete="off"
                        className="tabular-nums"
                        aria-label={`Serie ${i + 1}, Schuss ${j + 1}`}
                        value={shot}
                        disabled={disabled}
                        onChange={(e) =>
                          set(i, {
                            ...row,
                            shots: row.shots.map((s, k) => (k === j ? e.target.value : s)),
                          })
                        }
                        {...errorProps(`${shotId}-error`, shotError)}
                      />
                      <FieldError id={`${shotId}-error`} message={shotError} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={disabled}
          onClick={() => onChange([...rows, emptyRow(discipline)])}
        >
          <Plus aria-hidden className="size-4" />
          Serie hinzufügen
        </Button>
        {lastEmpty && (
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            disabled={disabled}
            onClick={() => onChange(rows.slice(0, -1))}
          >
            Entfernen
          </Button>
        )}
      </div>
    </div>
  )
}
