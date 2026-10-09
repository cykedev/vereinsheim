"use client"

import { formatDateOnly, formatIsoDate, zonedDayStartMs } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"
import { Sheet } from "@vereinsheim/ui/design2/sheet"
import { useState } from "react"

import { KIND_OPTIONS } from "../controls/CardFilters"
import type { CardKind } from "./state"
import {
  PREVIOUS_LABEL,
  ROLLING_CHOICES,
  type CompareChoice,
  type DateRange,
  type NamedPeriod,
  type PeriodChoice,
} from "./calendar"

/** was das Blatt „Filter“ setzt (U2, D3) */
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
  /** Trainings nur aus Probe mitzählen (Vorgabe ja) */
  includeProbeOnly: boolean
  /** Name des gewählten Vergleichs für den Chip; null ohne Vergleich */
  compareLabel?: string | null
  /** der Zeitraum der Wahl: sein Name steht auf dem Chip, seine Tage sind die Vorgabe für „Frei“ */
  range: DateRange
  named: readonly NamedPeriod[]
  timeZone: string
  onApply: (filters: PeriodFilters) => void
  className?: string
}

/**
 * Was der Chip zeigt (U2, D3): der Zeitraum und, was von der Vorgabe abweicht: die Art, ein Vergleich, ohne Trainings
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
    includeProbeOnly ? null : "ohne Probe-Training",
  ]
    .filter(Boolean)
    .join(" · ")
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** ist die Wahl gültig? Frei nur mit zwei Tagen, von nicht nach bis */
export function choiceValid(choice: PeriodChoice): boolean {
  if (choice.type !== "free") return true
  return /^\d{4}-\d{2}-\d{2}$/.test(choice.from) && /^\d{4}-\d{2}-\d{2}$/.test(choice.to)
    ? choice.from <= choice.to
    : false
}

/** „01.05.2026 – 30.06.2026“, „seit 01.08.2026“ */
export function namedSpan(period: NamedPeriod, timeZone: string): string {
  const day = (iso: string) => formatDateOnly(new Date(zonedDayStartMs(iso, timeZone)), timeZone)
  return period.to === null ? `seit ${day(period.from)}` : `${day(period.from)} – ${day(period.to)}`
}

const optionClass =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] hover:bg-surface-2 has-[:checked]:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"

/**
 * Blatt „Filter“ (Plan L3, D4, D6; U2, D3): ein Chip mit dem Zeitraum und dem, was abweicht, öffnet ein Blatt (auf dem
 * Telefon von unten) mit den rollenden Vorgaben, den benannten Zeiträumen, „Frei“ mit zwei Tagen, „Vergleichen mit“,
 * der Art und „Trainings nur aus Probe mitzählen“. Die Wahl gilt erst mit „Übernehmen“. „Als Zeitraum speichern“
 * kommt mit L6.
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
  className,
}: PeriodPickerProps) {
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

  const radio = (
    group: string,
    checked: boolean,
    onSelect: () => void,
    label: string,
    sub?: string,
    disabled = false
  ) => (
    <label key={`${group}:${label}`} className={cn(optionClass, disabled && "opacity-60")}>
      <input
        type="radio"
        name={group}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="size-4 accent-[var(--primary)]"
      />
      <span className="grid">
        <span>{label}</span>
        {sub && <span className="text-[12.5px] text-muted-foreground">{sub}</span>}
      </span>
    </label>
  )

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-period-chip
        onClick={show}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-accent-wash px-3 py-1.5 text-[13px] leading-none font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring",
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
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">
              Zeitraum
            </legend>
            {ROLLING_CHOICES.map((option) =>
              radio(
                "zeitraum",
                same(draft, option.choice),
                () => setDraft(option.choice),
                option.label
              )
            )}
            {named.map((period) =>
              radio(
                "zeitraum",
                same(draft, { type: "named", id: period.id }),
                () => setDraft({ type: "named", id: period.id }),
                period.name,
                namedSpan(period, timeZone)
              )
            )}
            {radio("zeitraum", draft.type === "free", () => setDraft(freeChoice), "Frei")}
            <div className="grid grid-cols-2 gap-2 pl-8">
              {(["from", "to"] as const).map((end) => (
                <label key={end} className="grid gap-1 text-[12.5px] text-muted-foreground">
                  {end === "from" ? "von" : "bis"}
                  <input
                    type="date"
                    value={free[end]}
                    disabled={draft.type !== "free"}
                    onChange={(event) => setFree({ ...free, [end]: event.target.value })}
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-[14px] text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                  />
                </label>
              ))}
            </div>
            {draft.type === "free" && !valid && (
              <p className="pl-8 text-[12.5px] text-destructive">
                Beide Tage wählen, „von“ nicht nach „bis“.
              </p>
            )}
          </fieldset>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">
              Vergleichen mit
            </legend>
            {radio(
              "vergleich",
              draftCompare.type === "none",
              () => setDraftCompare({ type: "none" }),
              "ohne"
            )}
            {radio(
              "vergleich",
              draftCompare.type === "previous",
              () => setDraftCompare({ type: "previous" }),
              PREVIOUS_LABEL,
              "gleich lang, direkt davor"
            )}
            {named.map((period) => {
              // ein Zeitraum gegen sich selbst wäre kein Vergleich
              const itself = same(current, { type: "named", id: period.id })
              return radio(
                "vergleich",
                same(draftCompare, { type: "named", id: period.id }),
                () => setDraftCompare({ type: "named", id: period.id }),
                period.name,
                itself ? "der gewählte Zeitraum" : namedSpan(period, timeZone),
                itself
              )
            })}
            <p className="pl-2 text-[12.5px] text-muted-foreground">
              Scheiben, die in beiden Zeiträumen liegen, zählen nur im gewählten.
            </p>
          </fieldset>
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">Art</legend>
            {KIND_OPTIONS.map((option) =>
              radio(
                "art",
                draftKind === option.value,
                () => setDraftKind(option.value),
                option.label
              )
            )}
          </fieldset>
          <label className={optionClass}>
            <input
              type="checkbox"
              checked={draftProbe}
              onChange={(event) => setDraftProbe(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span>Trainings nur aus Probe mitzählen</span>
          </label>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              const itself = draftCompare.type === "named" && same(current, draftCompare)
              onApply({
                choice: current,
                compare: itself ? { type: "none" } : draftCompare,
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
