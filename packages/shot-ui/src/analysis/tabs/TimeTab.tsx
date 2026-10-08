"use client"

import { cardTrend, rhythmProfile } from "@vereinsheim/shot-core/analysis"
import type { ReactNode } from "react"

import { formatSigned } from "../../format"
import { CourseChart } from "../charts/CourseChart"
import { ChartSlot } from "../charts/frame"
import { RhythmChart } from "../charts/RhythmChart"
import { AnalysisCard, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

/** Zeichen der Legende im Verlauf, 14 px */
function LegendItem({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 shrink-0">
        {children}
      </svg>
      {label}
    </span>
  )
}

/** Zeit und Verlauf: Verlauf und Trend, Rhythmus (breit), über die Grundlage */
export function timeCards({ input, explain }: CardContext): CardSpec[] {
  const { base, scoring } = input
  const trend = cardTrend(base, scoring)
  const timed = rhythmProfile(base).filter((p) => p.intervalMs !== null).length

  return [
    {
      key: "verlauf-und-trend",
      wide: true,
      element: (
        <AnalysisCard help="verlauf-und-trend" wide explain={explain}>
          {base.length >= 2 ? (
            <>
              <ChartSlot height={230}>
                {(width) => <CourseChart width={width} shots={base} scoring={scoring} />}
              </ChartSlot>
              <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
                <LegendItem label="Wert je Schuss">
                  <circle cx={7} cy={7} r={4} fill="var(--score-10)" />
                </LegendItem>
                <LegendItem label="Schnitt der letzten zehn">
                  <path d="M1 7h12" stroke="var(--primary)" strokeWidth={2} />
                </LegendItem>
                <LegendItem label="noch keine zehn">
                  <path d="M1 7h12" stroke="var(--primary)" strokeWidth={2} strokeDasharray="3 3" />
                </LegendItem>
                <LegendItem label="Pause">
                  <path
                    d="M7 1v12"
                    stroke="var(--warning)"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                </LegendItem>
              </div>
              <Note>
                {trend
                  ? `Trend ${formatSigned(trend.perTenShots, 2)} Ringe je zehn Schuss: ${trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"} (Mann-Kendall, 95 %)` : "nicht klar"}.`
                  : "Einen Trend gibt es ab 10 Schuss."}
              </Note>
            </>
          ) : (
            <Note>ab 2 Schuss</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "rhythmus",
      wide: true,
      element: (
        <AnalysisCard help="rhythmus" wide explain={explain}>
          {timed >= 2 ? (
            <>
              <ChartSlot height={190}>
                {(width) => <RhythmChart width={width} shots={base} />}
              </ChartSlot>
              <Note>
                Säule: Abstand zum vorigen Schuss; Linie: Median der letzten fünf Abstände, Pausen
                über drei Minuten zählen nicht hinein.
              </Note>
            </>
          ) : (
            <Note>ab 3 Schuss mit Zeit</Note>
          )}
        </AnalysisCard>
      ),
    },
  ]
}
