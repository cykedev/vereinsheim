"use client"

import { formatDateOnly, zonedDayStartMs } from "@vereinsheim/lib/format"
import { cn } from "@vereinsheim/lib/utils"

import { PREVIOUS_LABEL, ROLLING_CHOICES, type NamedPeriod, type PeriodChoice } from "./calendar"

/** eine Wahl im Blatt: ganze Zeile tippbar, die gewählte getönt */
export const OPTION_CLASS =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] hover:bg-surface-2 has-[:checked]:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"

/** eine Wahl als Radio mit Name und leiser Zeile darunter; ausgegraut, wenn sie nicht geht */
export function choiceRadio(
  group: string,
  checked: boolean,
  onSelect: () => void,
  label: string,
  sub?: string,
  disabled = false
) {
  return (
    <label key={`${group}:${label}`} className={cn(OPTION_CLASS, disabled && "opacity-60")}>
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
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** ist die Wahl gültig? Frei nur mit zwei Tagen, von nicht nach bis */
export function choiceValid(choice: PeriodChoice | "previous"): boolean {
  if (choice === "previous" || choice.type !== "free") return true
  return /^\d{4}-\d{2}-\d{2}$/.test(choice.from) && /^\d{4}-\d{2}-\d{2}$/.test(choice.to)
    ? choice.from <= choice.to
    : false
}

/** „01.05.2026 – 30.06.2026“, „seit 01.08.2026“ */
export function namedSpan(period: NamedPeriod, timeZone: string): string {
  const day = (iso: string) => formatDateOnly(new Date(zonedDayStartMs(iso, timeZone)), timeZone)
  return period.to === null ? `seit ${day(period.from)}` : `${day(period.from)} – ${day(period.to)}`
}

/**
 * Die Felder eines Zeitraums: die rollenden Vorgaben und „Alles“, die benannten Zeiträume, „Frei“ mit zwei Tagen und,
 * für die Seite B eines Vergleichs, „Zeitraum davor“. Gesteuert: Die Wahl und die freien Tage hält das Blatt, das sie
 * erst mit „Übernehmen“ übernimmt (Filter im Fortschritt, Seiten beim Vergleichen).
 */
export function PeriodChoiceFields({
  group,
  value,
  onChange,
  free,
  onFree,
  named,
  timeZone,
  withPrevious = false,
}: {
  /** Name der Radio-Gruppe, eindeutig auf der Seite */
  group: string
  /** die Wahl; bei „Frei“ gelten die Tage aus `free` */
  value: PeriodChoice | "previous"
  onChange: (value: PeriodChoice | "previous") => void
  free: { from: string; to: string }
  onFree: (free: { from: string; to: string }) => void
  named: readonly NamedPeriod[]
  timeZone: string
  /** „Zeitraum davor“ als erste Wahl (Seite B) */
  withPrevious?: boolean
}) {
  const isFree = value !== "previous" && value.type === "free"
  const valid = choiceValid(isFree ? { type: "free", ...free } : value)
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">Zeitraum</legend>
      {withPrevious &&
        choiceRadio(
          group,
          value === "previous",
          () => onChange("previous"),
          PREVIOUS_LABEL,
          "gleich lang, direkt vor A"
        )}
      {ROLLING_CHOICES.map((option) =>
        choiceRadio(group, same(value, option.choice), () => onChange(option.choice), option.label)
      )}
      {named.map((period) =>
        choiceRadio(
          group,
          same(value, { type: "named", id: period.id }),
          () => onChange({ type: "named", id: period.id }),
          period.name,
          namedSpan(period, timeZone)
        )
      )}
      {choiceRadio(group, isFree, () => onChange({ type: "free", ...free }), "Frei")}
      <div className="grid grid-cols-2 gap-2 pl-8">
        {(["from", "to"] as const).map((end) => (
          <label key={end} className="grid gap-1 text-[12.5px] text-muted-foreground">
            {end === "from" ? "von" : "bis"}
            <input
              type="date"
              value={free[end]}
              disabled={!isFree}
              onChange={(event) => onFree({ ...free, [end]: event.target.value })}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-[14px] text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            />
          </label>
        ))}
      </div>
      {isFree && !valid && (
        <p className="pl-8 text-[12.5px] text-destructive">
          Beide Tage wählen, „von“ nicht nach „bis“.
        </p>
      )}
    </fieldset>
  )
}
