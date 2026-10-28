"use client"

import type { CardMark } from "@vereinsheim/shot-core/projection"
import { formatValue } from "@vereinsheim/shot-ui/format"

import type { ResultCard, ResultSeries } from "@/lib/results-read"

import { saveExecution } from "../actions"
import { QUALITY_WORDS } from "../scales"
import { ENTRY_TEXTS } from "../texts"

import { CardHead } from "./CardHead"
import { EntrySection } from "./EntrySection"
import { StageRow } from "./StageRow"
import { useStages } from "./useStages"

/**
 * Ausführung je Serie: jede Scheibe des Eintrags ein eigener Block, im Kopf wie in der Scheibenliste (kleine Scheibe,
 * Uhrzeit, Ringe), darunter eingerückt ihre Serien („Serie 3“, darunter die Summe) mit fünf Stufen. So ist auch bei
 * sechs Scheiben klar, welche Serie zu welcher gehört.
 */
export function ExecutionSection({
  entryId,
  day,
  cards,
  series,
  marks,
  values,
  timeZone,
}: {
  entryId: string
  day: string
  cards: ResultCard[]
  series: Record<string, ResultSeries[]>
  marks: Record<string, CardMark[]>
  /** Wert je `cardId|series` */
  values: Readonly<Record<string, number | null>>
  timeZone: string
}) {
  const { shown, select, error } = useStages(values, (key, stage) => {
    const [cardId, number] = key.split("|")
    return saveExecution(entryId, cardId, Number(number), stage)
  })
  const rated = cards.filter((card) => (series[card.id] ?? []).length > 0)
  return (
    <EntrySection
      entryId={entryId}
      section="execution"
      title={ENTRY_TEXTS.execution}
      hint={ENTRY_TEXTS.executionHint}
      day={day}
      filled={Object.values(values).some((value) => value !== null)}
    >
      {/* jede Scheibe ein Block (getrennt durch Linien), ihre Serien eingerückt darunter; die Summe steht in der
          zweiten Zeile, damit „Serie 3“ auch bei 360 px neben den fünf Kreisen einzeilig bleibt */}
      <div className="grid divide-y divide-border">
        {rated.map((card) => (
          <div key={card.id} data-execution-card={card.id} className="grid gap-1 py-3 first:pt-1">
            <CardHead card={card} marks={marks} timeZone={timeZone} />
            <div className="grid divide-y divide-border border-l-2 border-line-strong pl-3">
              {series[card.id].map((s) => {
                const key = `${card.id}|${s.series}`
                return (
                  <StageRow
                    key={key}
                    label={`Serie ${s.series}`}
                    detail={s.result ? formatValue(s.result.value, s.result.digits) : null}
                    words={QUALITY_WORDS}
                    value={shown[key] ?? null}
                    onSelect={(stage) => select(key, stage)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </EntrySection>
  )
}
