"use client"

import { cn } from "@vereinsheim/lib/utils"

import { STAGES, stageOf, type Stage } from "../scales"

/**
 * Eine Zeile mit fünf Stufen: Name, darunter das Wort der gezeigten Stufe (ohne Wert „noch offen“, mit Prognose deren
 * Wort), rechts fünf weiche Kreise mit 1 bis 5 (32 px wie Art und Wertung an der Scheibe). Ein Tipp wählt die Stufe,
 * ein Tipp auf die gezeigte nimmt sie zurück (`onSelect(null)`). `mark` zeigt eine zweite Stufe gestrichelt (die
 * Prognose im Feedback).
 */
export function StageRow({
  label,
  words,
  value,
  mark = null,
  disabled = false,
  onSelect,
}: {
  label: string
  words: readonly string[]
  /** der Wert 0 bis 100; null ohne */
  value: number | null
  mark?: number | null
  disabled?: boolean
  onSelect: (stage: Stage | null) => void
}) {
  const shown = value === null ? null : stageOf(value)
  const marked = mark === null ? null : stageOf(mark)
  const word =
    shown !== null ? words[shown - 1] : marked !== null ? `Prognose: ${words[marked - 1]}` : null
  return (
    <div data-stage-row className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1.5">
      <span className="grid min-w-0">
        <span className="text-sm font-semibold">{label}</span>
        {/* ohne Wert kein Wort: „noch offen“ unter jeder Zeile war nur Rauschen */}
        {word && <span className="text-[13px] text-muted-foreground">{word}</span>}
      </span>
      <span role="group" aria-label={label} className="flex gap-1.5">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            disabled={disabled}
            aria-pressed={shown === stage}
            aria-label={`${label}: ${stage}, ${words[stage - 1]}`}
            data-stage={stage}
            onClick={() => onSelect(shown === stage ? null : stage)}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-full text-[13px] font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default",
              shown === stage
                ? "bg-primary text-primary-foreground"
                : "border border-line-strong bg-card text-muted-foreground hover:bg-surface-2",
              marked === stage && "outline-2 outline-offset-2 outline-foreground-2 outline-dashed"
            )}
          >
            {stage}
          </button>
        ))}
      </span>
    </div>
  )
}
