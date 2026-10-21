"use client"

import { cn } from "@vereinsheim/lib/utils"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

import { HelpButton } from "../help/HelpButton"
import { PERIOD_CHART_METRICS } from "./model"
import { usePeriodWords } from "./PeriodWords"
import type { PeriodMetricKey, PeriodShow } from "./state"

export type PeriodChartView = "cards" | "months"

export interface PeriodChartBarProps {
  metric: PeriodMetricKey
  /** Darstellung des Verlaufs; null mit Vergleich (dann gibt es nur Scheiben übereinander) */
  view: PeriodChartView | null
  onMetric: (metric: PeriodMetricKey) => void
  onView: (view: PeriodChartView) => void
  /** das „?“ zum Verlauf (`verlauf-und-form`) */
  onHelp: () => void
  /** die Kennzahlen zur Wahl (Vorgabe die von Spiegel, `PERIOD_CHART_METRICS`) */
  metrics?: readonly { key: PeriodMetricKey; label: string }[]
  /** Hauptbild: Verlauf oder Trefferbild; ohne `onShow` (Treffsicher) kein Umschalter */
  show?: PeriodShow
  onShow?: (show: PeriodShow) => void
  /** das „?“ zum Trefferbild (`langzeit-trefferbild`) */
  onPatternHelp?: () => void
}

const SHOWS = [
  { value: "history", label: "Verlauf" },
  { value: "target", label: "Trefferbild" },
] as const

/**
 * Bedienung über dem Hauptbild: mit `onShow` zuerst der Umschalter „Verlauf | Trefferbild“ in einer eigenen Zeile; beim
 * Trefferbild steht dort nur noch sein „?“, die Sicht wählt das Bild selbst (`PatternPanel`). Über dem Verlauf:
 * Kennzahl, Darstellung, „?“. In einer Zeile, wenn alles passt; sonst die Kennzahl oben,
 * darunter die Darstellung links und das „?“ rechts. Mit `flex-wrap` rutschte die Darstellung allein rechts in eine
 * zweite Zeile. Gemessen an der Karte (Container), nicht am Fenster: ab 768 px steht der Verlauf in der linken Spalte.
 */
export function PeriodChartBar({
  metric,
  view,
  onMetric,
  onView,
  onHelp,
  metrics = PERIOD_CHART_METRICS,
  show = "history",
  onShow,
  onPatternHelp,
}: PeriodChartBarProps) {
  const words = usePeriodWords()
  const showSwitch = onShow && (
    <Segmented label="Hauptbild" value={show} options={SHOWS} onChange={onShow} />
  )
  if (showSwitch && show === "target")
    return (
      <div data-chart-bar className="flex min-w-0 items-center gap-2">
        {showSwitch}
        {onPatternHelp && (
          <HelpButton
            label="Trefferbild über den Zeitraum"
            helpId="langzeit-trefferbild"
            onClick={onPatternHelp}
            className="ml-auto"
          />
        )}
      </div>
    )
  const help = (
    <HelpButton
      label="Verlauf und Form"
      helpId="verlauf-und-form"
      onClick={onHelp}
      className="ml-auto"
    />
  )
  const bar = (
    <div className="@container min-w-0">
      <div
        data-chart-bar
        className={cn(
          "flex min-w-0 gap-2",
          view
            ? "flex-col items-start @min-[35rem]:flex-row @min-[35rem]:items-center"
            : "items-center"
        )}
      >
        {/* ohne Umbruch in einer Zeile (Namen wie „Streuung“ sind lang); ist sie zu breit, scrollt sie in sich */}
        <Segmented
          label="Kennzahl"
          value={metric}
          options={metrics.map((m) => ({ value: m.key, label: m.label }))}
          onChange={onMetric}
          scroll
        />
        {view ? (
          <div className="flex w-full items-center gap-2 @min-[35rem]:ml-auto @min-[35rem]:w-auto">
            <Segmented
              label="Darstellung des Verlaufs"
              value={view}
              options={[
                { value: "cards", label: `je ${words.one}` },
                { value: "months", label: "je Monat" },
              ]}
              onChange={onView}
            />
            {help}
          </div>
        ) : (
          help
        )}
      </div>
    </div>
  )
  return showSwitch ? (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0">{showSwitch}</div>
      {bar}
    </div>
  ) : (
    bar
  )
}
