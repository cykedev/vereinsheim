"use client"

import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"

import { cn } from "@vereinsheim/lib/utils"
import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"

import {
  emptyRow,
  parseValue,
  seriesSumText,
  shotComplete,
  toggleRow,
  type FormDiscipline,
  type SeriesRow,
  type ValueMode,
} from "@/lib/entered/form"

const errorProps = (id: string, message: string | undefined) =>
  message ? { "aria-invalid": true as const, "aria-describedby": id } : {}

/** das nächste Feld der Eingabe nach `current` (Summen und Schüsse in der Folge der Seite); fokussiert und markiert */
function focusNext(current: HTMLElement) {
  const fields = [
    ...(current.closest("form") ?? document).querySelectorAll<HTMLInputElement>(
      "input[data-entry-field]:not([readonly]):not([disabled])"
    ),
  ]
  const next = fields[fields.indexOf(current as HTMLInputElement) + 1]
  if (!next) return false
  next.focus()
  next.select()
  return true
}

const empty = (row: SeriesRow) => !row.sum.trim() && row.shots.every((s) => !s.trim())

/**
 * Serien im Formular „Ergebnis eintragen“, je Serie eine Zeile: Name, Summe und „Schüsse einzeln“ zum Aufklappen (dann
 * kommt die Summe aus den Schüssen und ist gesperrt). Schnell zu tippen: Ein fertiger Schuss springt ins nächste Feld,
 * Enter ebenso; nach dem letzten Schuss einer Serie klappt die nächste leere Serie auf. Ein Wert, der nicht passt, sagt
 * es beim Verlassen des Felds. Am Ende „Serie hinzufügen“, eine leere letzte Serie lässt sich entfernen.
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
  // Fehler beim Verlassen eines Felds; ein Fehler der Action geht vor
  const [blurErrors, setBlurErrors] = useState<Record<string, string>>({})
  // nach dem Aufklappen der nächsten Serie: ihr erster Schuss bekommt den Fokus
  const focusShot = useRef<string | null>(null)
  useEffect(() => {
    if (!focusShot.current) return
    document.getElementById(focusShot.current)?.focus()
    focusShot.current = null
  })

  const set = (i: number, row: SeriesRow) => onChange(rows.map((r, j) => (j === i ? row : r)))
  const errorFor = (field: string) => errorOf(field) ?? blurErrors[field]
  const check = (field: string, text: string, shots: number) => {
    const parsed = parseValue(text, mode, shots)
    setBlurErrors((current) => {
      const { [field]: _, ...rest } = current
      return parsed.ok ? rest : { ...rest, [field]: parsed.error }
    })
  }
  const clear = (field: string) =>
    setBlurErrors((current) => {
      const { [field]: _, ...rest } = current
      return rest
    })

  /** weiter nach einem Schuss: im letzten Feld einer Serie die nächste leere aufklappen */
  const advance = (target: HTMLInputElement, i: number, j: number, next: SeriesRow[]) => {
    const following = next[i + 1]
    if (j === next[i]!.shots.length - 1 && following && !following.open && empty(following)) {
      onChange(next.map((r, k) => (k === i + 1 ? toggleRow(r, mode, discipline) : r)))
      focusShot.current = `series-${i + 1}-shot-0`
      return
    }
    focusNext(target)
  }

  const last = rows[rows.length - 1]
  const lastEmpty = rows.length > 1 && last !== undefined && empty(last)
  const inputMode = mode === "rings" ? "numeric" : "decimal"

  return (
    <div className="grid gap-1" data-entered-series>
      {rows.map((row, i) => {
        const sumId = `series-${i}-sum`
        const sumError = errorFor(`series.${i}.sum`)
        const computed = row.open ? seriesSumText(row, mode) : null
        return (
          <div
            key={i}
            // die Fläche einer aufgeklappten Serie liegt nach außen: Name, Summe und Knopf stehen in jeder Serie gleich
            className={cn(
              "-mx-2.5 grid gap-2 rounded-xl px-2.5 py-1.5",
              row.open && "bg-surface-2 py-2.5"
            )}
            data-entered-row={i + 1}
          >
            {/* passt auch in 360 px: das Summenfeld gibt nach, Name und Knopf nicht */}
            <div className="flex items-center gap-2">
              <label htmlFor={sumId} className="w-16 shrink-0 text-sm font-semibold">
                Serie {i + 1}
              </label>
              <Input
                id={sumId}
                inputMode={inputMode}
                enterKeyHint="next"
                autoComplete="off"
                data-entry-field
                className={cn(
                  "h-11 w-0 max-w-28 min-w-0 grow text-center text-base tabular-nums",
                  row.open && "border-transparent bg-transparent font-semibold"
                )}
                value={row.open ? (computed ?? "") : row.sum}
                readOnly={row.open}
                disabled={disabled}
                {...(row.open ? { "aria-describedby": `${sumId}-from-shots` } : {})}
                onChange={(e) => {
                  clear(`series.${i}.sum`)
                  set(i, { ...row, sum: e.target.value })
                }}
                onBlur={(e) =>
                  !row.open && check(`series.${i}.sum`, e.target.value, discipline.seriesShots ?? 1)
                }
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key !== "Enter") return
                  e.preventDefault()
                  focusNext(e.currentTarget)
                }}
                {...errorProps(`${sumId}-error`, sumError)}
              />
              <Button
                type="button"
                variant="ghost"
                className="ml-auto h-10 shrink-0 px-2 text-[13px]"
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
              <p
                id={`${sumId}-from-shots`}
                className="-mt-1 pl-18 text-[13px] text-muted-foreground"
              >
                aus den Schüssen
              </p>
            )}
            <FieldError id={`${sumId}-error`} message={sumError} />
            {row.open && (
              <div id={`series-${i}-shots`} className="grid grid-cols-5 gap-2">
                {row.shots.map((shot, j) => {
                  const field = `series.${i}.shot.${j}`
                  const shotId = `series-${i}-shot-${j}`
                  const shotError = errorFor(field)
                  return (
                    <div key={j} className="grid gap-1">
                      <Input
                        id={shotId}
                        inputMode={inputMode}
                        enterKeyHint="next"
                        autoComplete="off"
                        data-entry-field
                        className="h-11 px-1 text-center text-base tabular-nums"
                        aria-label={`Serie ${i + 1}, Schuss ${j + 1}`}
                        value={shot}
                        disabled={disabled}
                        onChange={(e) => {
                          const value = e.target.value
                          const next = rows.map((r, k) =>
                            k === i
                              ? { ...r, shots: r.shots.map((s, m) => (m === j ? value : s)) }
                              : r
                          )
                          clear(field)
                          onChange(next)
                          if (shotComplete(value, mode)) advance(e.currentTarget, i, j, next)
                        }}
                        onBlur={(e) => check(field, e.target.value, 1)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key !== "Enter") return
                          e.preventDefault()
                          advance(e.currentTarget, i, j, rows)
                        }}
                        {...errorProps(`${shotId}-error`, shotError)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            {row.open &&
              row.shots.map((_, j) => (
                <FieldError
                  key={j}
                  id={`series-${i}-shot-${j}-error`}
                  message={errorFor(`series.${i}.shot.${j}`)}
                />
              ))}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-2 pt-2">
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
