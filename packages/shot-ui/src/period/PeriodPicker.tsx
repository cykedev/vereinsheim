"use client"

import { formatIsoDate } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { Sheet } from "@vereinsheim/ui/design2/sheet"
import { useState } from "react"

import { KIND_OPTIONS } from "../controls/CardFilters"
import {
  choiceRadio,
  choiceValid,
  namedSpan,
  OPTION_CLASS,
  PeriodChoiceFields,
} from "./PeriodChoiceFields"
import { usePeriodWords } from "./PeriodWords"
import type { CardKind } from "./state"
import {
  PREVIOUS_LABEL,
  type CompareChoice,
  type DateRange,
  type NamedPeriod,
  type PeriodChoice,
} from "./calendar"

/** was das Blatt „Filter“ setzt */
export interface PeriodFilters {
  choice: PeriodChoice
  compare: CompareChoice
  kind: CardKind
  includeProbeOnly: boolean
}

export interface PeriodPickerProps {
  choice: PeriodChoice
  compare: CompareChoice
  /** Art der Scheiben (Alle, Training, Wettkampf) */
  kind: CardKind
  /** Scheiben nur aus Probe mitzählen (Vorgabe ja) */
  includeProbeOnly: boolean
  /** Name des gewählten Vergleichs für den Chip; null ohne Vergleich */
  compareLabel?: string | null
  /** der Zeitraum der Wahl: sein Name steht auf dem Chip, seine Tage sind die Vorgabe für „Frei“ */
  range: DateRange
  named: readonly NamedPeriod[]
  timeZone: string
  onApply: (filters: PeriodFilters) => void
  /** der Schalter „Scheiben nur aus Probe mitzählen“ (Vorgabe ja); ohne bleibt `includeProbeOnly` wie gegeben */
  probeOnlySwitch?: boolean
  /** „Vergleichen mit“ im Blatt (Vorgabe ja); ohne gibt das Blatt immer „ohne Vergleich“ zurück (Spiegel vergleicht auf eigener Seite) */
  withCompare?: boolean
  className?: string
}

/**
 * Was der Chip zeigt: der Zeitraum und, was von der Vorgabe abweicht: die Art, ein Vergleich, ohne Trainings
 * nur aus Probe. „Letzte 90 Tage · Training · mit Zeitraum davor“
 */
export function filterSummary(
  label: string,
  {
    kind,
    compareLabel,
    includeProbeOnly,
  }: { kind: CardKind; compareLabel: string | null; includeProbeOnly: boolean }
): string {
  return [
    label,
    kind === "all" ? null : (KIND_OPTIONS.find((o) => o.value === kind)?.label ?? null),
    compareLabel ? `mit ${compareLabel}` : null,
    includeProbeOnly ? null : "ohne Probe-Scheiben",
  ]
    .filter(Boolean)
    .join(" · ")
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Blatt „Filter“: ein Chip mit dem Zeitraum und dem, was abweicht, öffnet ein Blatt (auf dem Telefon von unten) mit
 * den rollenden Vorgaben, den benannten Zeiträumen, „Frei“ mit zwei Tagen, „Vergleichen mit“, der Art und „Trainings
 * nur aus Probe mitzählen“. Die Wahl gilt erst mit „Übernehmen“. „Als Zeitraum speichern“ gibt es noch nicht.
 */
export function PeriodPicker({
  choice,
  compare,
  kind,
  includeProbeOnly,
  compareLabel = null,
  range,
  named,
  timeZone,
  onApply,
  probeOnlySwitch = true,
  withCompare = true,
  className,
}: PeriodPickerProps) {
  const words = usePeriodWords()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(choice)
  const [draftCompare, setDraftCompare] = useState(compare)
  const [draftKind, setDraftKind] = useState(kind)
  const [draftProbe, setDraftProbe] = useState(includeProbeOnly)
  const iso = (ms: number) => formatIsoDate(new Date(ms), timeZone)
  const [free, setFree] = useState(() =>
    choice.type === "free"
      ? { from: choice.from, to: choice.to }
      : { from: iso(range.fromMs), to: iso(range.toMs - 1) }
  )
  const show = () => {
    setDraft(choice)
    setDraftCompare(compare)
    setDraftKind(kind)
    setDraftProbe(includeProbeOnly)
    // nicht übernommene freie Tage gelten nicht: immer vom aktuellen Zeitraum aus beginnen
    setFree(
      choice.type === "free"
        ? { from: choice.from, to: choice.to }
        : { from: iso(range.fromMs), to: iso(range.toMs - 1) }
    )
    setOpen(true)
  }
  const freeChoice: PeriodChoice = { type: "free", from: free.from, to: free.to }
  const current = draft.type === "free" ? freeChoice : draft
  const valid = choiceValid(current)

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-period-chip
        onClick={show}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-accent-wash px-3 py-1.5 text-[13px] leading-tight font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          className
        )}
      >
        {filterSummary(range.label, { kind, compareLabel, includeProbeOnly })}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filter">
        <div data-period-picker className="grid gap-4">
          <PeriodChoiceFields
            group="zeitraum"
            value={draft}
            onChange={(value) => value !== "previous" && setDraft(value)}
            free={free}
            onFree={setFree}
            named={named}
            timeZone={timeZone}
          />
          {withCompare && (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">
                Vergleichen mit
              </legend>
              {choiceRadio(
                "vergleich",
                draftCompare.type === "none",
                () => setDraftCompare({ type: "none" }),
                "ohne"
              )}
              {choiceRadio(
                "vergleich",
                draftCompare.type === "previous",
                () => setDraftCompare({ type: "previous" }),
                PREVIOUS_LABEL,
                "gleich lang, direkt davor"
              )}
              {named.map((period) => {
                // ein Zeitraum gegen sich selbst wäre kein Vergleich
                const itself = same(current, { type: "named", id: period.id })
                return choiceRadio(
                  "vergleich",
                  same(draftCompare, { type: "named", id: period.id }),
                  () => setDraftCompare({ type: "named", id: period.id }),
                  period.name,
                  itself ? "der gewählte Zeitraum" : namedSpan(period, timeZone),
                  itself
                )
              })}
              <p className="pl-2 text-[12.5px] text-muted-foreground">
                {`${words.many}, die in beiden Zeiträumen liegen, zählen nur im gewählten.`}
              </p>
            </fieldset>
          )}
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">Art</legend>
            {KIND_OPTIONS.map((option) =>
              choiceRadio(
                "art",
                draftKind === option.value,
                () => setDraftKind(option.value),
                option.label
              )
            )}
          </fieldset>
          {probeOnlySwitch && (
            <label className={OPTION_CLASS}>
              <input
                type="checkbox"
                checked={draftProbe}
                onChange={(event) => setDraftProbe(event.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span>Scheiben nur aus Probe mitzählen</span>
            </label>
          )}
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              const itself = draftCompare.type === "named" && same(current, draftCompare)
              onApply({
                choice: current,
                compare: !withCompare || itself ? { type: "none" } : draftCompare,
                kind: draftKind,
                includeProbeOnly: draftProbe,
              })
              setOpen(false)
            }}
            className="cursor-pointer justify-self-end rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            Übernehmen
          </button>
        </div>
      </Sheet>
    </>
  )
}
