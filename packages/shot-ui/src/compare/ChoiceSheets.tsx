"use client"

import { formatIsoDate, formatTimeOfDay, formatWeekdayDay } from "@vereinsheim/lib/format"
import { Sheet } from "@vereinsheim/ui/design2/sheet"
import { useState } from "react"

import type { DateRange, NamedPeriod, PeriodChoice } from "../period/calendar"
import { choiceRadio, choiceValid, PeriodChoiceFields } from "../period/PeriodChoiceFields"

/** eine Scheibe im Blatt: Beginn, Ergebnis in der Wertung der Familie (schon formatiert) und Schusszahl */
export interface CardChoice {
  id: string
  startedAtMs: number
  total: string | null
  shots: number
  /** die Uhrzeit ist nicht bekannt; nur dann gesetzt */
  timeUnknown?: true
}

/** so viele Scheiben zeigt das Blatt auf einmal, „Mehr zeigen“ die nächsten */
export const CARD_CHOICE_PAGE = 30

const BUTTON =
  "cursor-pointer justify-self-end rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"

interface CardChoiceProps {
  title: string
  choices: readonly CardChoice[]
  current: string | null
  other: string | null
  timeZone: string
  onChoose: (id: string) => void
  onClose: () => void
}

/** die Liste im Blatt, je Öffnen neu: „Mehr zeigen“ beginnt wieder bei 30 */
function CardChoiceList({
  title,
  choices,
  current,
  other,
  timeZone,
  onChoose,
  onClose,
}: CardChoiceProps) {
  const [shown, setShown] = useState(CARD_CHOICE_PAGE)
  return (
    <div data-card-choices className="grid gap-1">
      {choices.slice(0, shown).map((choice) => {
        const at = new Date(choice.startedAtMs)
        const label = choice.timeUnknown
          ? formatWeekdayDay(at, timeZone)
          : `${formatWeekdayDay(at, timeZone)} ${formatTimeOfDay(at, timeZone)}`
        const sub =
          choice.id === other
            ? "auf der anderen Seite"
            : [choice.total, `${choice.shots} Schuss`].filter(Boolean).join(" · ")
        return choiceRadio(
          `scheibe-${title}`,
          choice.id === current,
          () => {
            onChoose(choice.id)
            onClose()
          },
          label,
          sub,
          choice.id === other
        )
      })}
      {choices.length > shown && (
        <button
          type="button"
          onClick={() => setShown(shown + CARD_CHOICE_PAGE)}
          className="mt-2 cursor-pointer justify-self-start rounded-full border border-line-strong px-4 py-2 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-ring"
        >
          Mehr zeigen
        </button>
      )}
    </div>
  )
}

/**
 * Blatt „Scheibe A“ oder „Scheibe B“: die Scheiben der Familie, die neueste zuerst, 30 auf einmal. Die Scheibe der
 * anderen Seite geht nicht. Ein Tippen wählt und schließt.
 */
export function CardChoiceSheet({ open, ...props }: CardChoiceProps & { open: boolean }) {
  return (
    <Sheet open={open} onClose={props.onClose} title={props.title}>
      {open && <CardChoiceList {...props} />}
    </Sheet>
  )
}

/** der Inhalt des Blatts, je Öffnen neu: Entwurf und freie Tage beginnen bei der aktuellen Wahl */
function PeriodChoiceDraft({
  title,
  value,
  range,
  named,
  timeZone,
  withPrevious,
  onApply,
}: {
  title: string
  value: PeriodChoice | "previous"
  range: DateRange
  named: readonly NamedPeriod[]
  timeZone: string
  withPrevious: boolean
  onApply: (value: PeriodChoice | "previous") => void
}) {
  const iso = (ms: number) => formatIsoDate(new Date(ms), timeZone)
  const [draft, setDraft] = useState(value)
  const [free, setFree] = useState(() =>
    value !== "previous" && value.type === "free"
      ? { from: value.from, to: value.to }
      : { from: iso(range.fromMs), to: iso(range.toMs - 1) }
  )
  const current: PeriodChoice | "previous" =
    draft !== "previous" && draft.type === "free" ? { type: "free", ...free } : draft
  return (
    <div data-period-choice className="grid gap-4">
      <PeriodChoiceFields
        group={`zeitraum-${title}`}
        value={draft}
        onChange={setDraft}
        free={free}
        onFree={setFree}
        named={named}
        timeZone={timeZone}
        withPrevious={withPrevious}
      />
      <button
        type="button"
        disabled={!choiceValid(current)}
        onClick={() => onApply(current)}
        className={BUTTON}
      >
        Übernehmen
      </button>
    </div>
  )
}

/**
 * Blatt „Zeitraum A“, „Zeitraum B“ oder „Zeitraum“: dieselben Felder wie im Blatt „Filter“ des Fortschritts, bei B
 * dazu „Zeitraum davor“. Die Wahl gilt erst mit „Übernehmen“.
 */
export function PeriodChoiceSheet({
  open,
  onClose,
  title,
  value,
  range,
  named,
  timeZone,
  withPrevious = false,
  onApply,
}: {
  open: boolean
  onClose: () => void
  title: string
  value: PeriodChoice | "previous"
  /** der Zeitraum der Wahl: seine Tage sind die Vorgabe für „Frei“ */
  range: DateRange
  named: readonly NamedPeriod[]
  timeZone: string
  withPrevious?: boolean
  onApply: (value: PeriodChoice | "previous") => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && (
        <PeriodChoiceDraft
          title={title}
          value={value}
          range={range}
          named={named}
          timeZone={timeZone}
          withPrevious={withPrevious}
          onApply={(next) => {
            onApply(next)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}
