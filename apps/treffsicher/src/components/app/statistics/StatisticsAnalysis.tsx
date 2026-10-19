"use client"

import { useState } from "react"

import type { RingDistribution } from "@vereinsheim/shot-core/analysis"
import { HelpIcon } from "@vereinsheim/shot-ui/help/HelpButton"
import { PeriodInsights } from "@vereinsheim/shot-ui/period/PeriodInsights"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"

import type { Influence } from "@/lib/statistics/influences"
import type { LocationSummary } from "@/lib/statistics/location"
import type { OverviewTableGroup } from "@/lib/statistics/overview"
import type { SelfImage } from "@/lib/statistics/selfImage"

import { StatisticsInfluences } from "./StatisticsInfluences"
import { StatisticsLocation } from "./StatisticsLocation"
import type { StatisticsPartProps } from "./StatisticsParts"
import { StatisticsSelfImage } from "./StatisticsSelfImage"

type AnalysisTab = "records" | "location" | "influences" | "selfImage"

/** was der Server über die Einheiten des Zeitraums mitgibt: Einflüsse, Selbstbild, Tabelle, Trefferlage, Ringverteilung */
export interface StatisticsAnalysisData {
  influences: Influence[]
  selfImage: SelfImage
  /** Tabelle der Serien je Einheit; null ohne Einheit */
  overview: OverviewTableGroup | null
  location: LocationSummary
  rings: { dist: RingDistribution; sessions: number }
}

/** Analyse in vier Reitern: Rekorde, Trefferlage, Einflüsse, Selbstbild */
export function StatisticsAnalysis({
  model,
  state,
  timeZone,
  actions: { onHelp, dispatch, jumpTo },
  analysis,
}: StatisticsPartProps & { analysis: StatisticsAnalysisData }) {
  const [explain, setExplain] = useState(false)
  const [tab, setTab] = useState<AnalysisTab>("records")
  const help = { explain, onHelp: (id: string) => onHelp(id) }
  const chooseFromRecord = (id: string) => {
    if (state.chosen !== id) dispatch({ type: "choose", id })
    const shown = [...document.querySelectorAll("[data-card-readout], [data-card-line]")].find(
      (el) => el.getClientRects().length > 0
    )
    jumpTo(document.getElementById("history"), "Analyse", shown ?? null)
  }
  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Reiter der Analyse"
          value={tab}
          options={[
            { value: "records", label: "Rekorde" },
            { value: "location", label: "Trefferlage" },
            { value: "influences", label: "Einflüsse" },
            { value: "selfImage", label: "Selbstbild" },
          ]}
          onChange={setTab}
          // vier Reiter sind am schmalen Telefon breiter als die Seite: dort scrollen sie in sich
          scroll
        />
        <ToggleChip pressed={explain} icon={<HelpIcon />} onPressedChange={setExplain}>
          Erklärungen
        </ToggleChip>
      </div>
      {tab === "records" ? (
        <PeriodInsights
          model={model}
          scoring={state.scoring}
          timeZone={timeZone}
          explain={explain}
          onHelp={onHelp}
          onChoose={chooseFromRecord}
          chosen={state.chosen}
        />
      ) : tab === "location" ? (
        <StatisticsLocation summary={analysis.location} timeZone={timeZone} help={help} />
      ) : tab === "influences" ? (
        <StatisticsInfluences rows={analysis.influences} help={help} />
      ) : (
        <StatisticsSelfImage image={analysis.selfImage} help={help} />
      )}
    </div>
  )
}
