"use client"

import { formatTimeOfDay } from "@vereinsheim/lib/format"

import type { ResultCard, ResultSeries } from "@/lib/results-read"

import { saveExecution } from "../actions"
import { QUALITY_WORDS } from "../scales"
import { resultText } from "../summaries"
import { ENTRY_TEXTS } from "../texts"

import { EntrySection } from "./EntrySection"
import { StageRow } from "./StageRow"
import { useStages } from "./useStages"

/**
 * Ausführung je Serie: je Scheibe des Eintrags ihre Serien mit Summe und fünf Stufen. Mit mehreren Scheiben steht über
 * jeder ihre Uhrzeit und ihr Ergebnis.
 */
export function ExecutionSection({
  entryId,
  day,
  cards,
  series,
  values,
  timeZone,
}: {
  entryId: string
  day: string
  cards: ResultCard[]
  series: Record<string, ResultSeries[]>
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
      {rated.map((card) => (
        <div key={card.id} className="grid">
          {rated.length > 1 && (
            <h4 className="pt-2 text-sm font-semibold tabular-nums">
              {`${card.timeUnknown ? "Uhrzeit unbekannt" : formatTimeOfDay(new Date(card.startedAtMs), timeZone)}${
                card.result ? ` · ${resultText(card.result)}` : ""
              }`}
            </h4>
          )}
          <div className="grid divide-y divide-border">
            {series[card.id].map((s) => {
              const key = `${card.id}|${s.series}`
              return (
                <StageRow
                  key={key}
                  label={`Serie ${s.series}${s.result ? ` · ${resultText(s.result)}` : ""}`}
                  words={QUALITY_WORDS}
                  value={shown[key] ?? null}
                  onSelect={(stage) => select(key, stage)}
                />
              )
            })}
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </EntrySection>
  )
}
