"use client"

import { RingBars } from "@vereinsheim/shot-ui/analysis/charts/RingBars"
import { PeriodTiles } from "@vereinsheim/shot-ui/period/PeriodTiles"
import { countOf } from "@vereinsheim/shot-ui/period/words"

import { metricHelpId } from "@/lib/help/topics"
import { SESSION_WORDS } from "@/lib/statistics/words"

import { DisciplineOverviewTable } from "./overview"
import { StatisticsAnalysis, type StatisticsAnalysisData } from "./StatisticsAnalysis"
import { box, type StatisticsPartProps } from "./StatisticsParts"

/** Zahlen und Analyse unter Verlauf und Liste */
export function statisticsBelow(props: StatisticsPartProps & { analysis: StatisticsAnalysisData }) {
  return [
    {
      id: "numbers" as const,
      node: (
        <div className="grid min-w-0 gap-4">
          <PeriodTiles
            tiles={props.model.tiles}
            compareLabel={props.model.compareRange?.label ?? null}
            onHelp={(key) => props.actions.onHelp(metricHelpId(key))}
          />
          {props.analysis.rings.dist.n > 0 && (
            <article data-period-rings className={`grid gap-3 p-4 ${box}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base font-bold">Ringverteilung</h3>
                <span className="text-[13px] text-muted-foreground">
                  {`${props.analysis.rings.dist.n} Wertungsschüsse aus ${countOf(props.analysis.rings.sessions, SESSION_WORDS)}`}
                </span>
              </div>
              <RingBars dist={props.analysis.rings.dist} />
            </article>
          )}
          {props.analysis.overview && (
            <DisciplineOverviewTable group={props.analysis.overview} timeZone={props.timeZone} />
          )}
        </div>
      ),
    },
    { id: "analysis" as const, node: <StatisticsAnalysis {...props} /> },
  ]
}
