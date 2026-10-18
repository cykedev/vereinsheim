"use client"

import { useState } from "react"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { HitLocationTab } from "@/components/app/statistics-charts/tabs/HitLocationTab"
import { OverviewTab } from "@/components/app/statistics-charts/tabs/OverviewTab"
import { QualityTab } from "@/components/app/statistics-charts/tabs/QualityTab"
import { SelfAssessmentTab } from "@/components/app/statistics-charts/tabs/SelfAssessmentTab"
import { TrendTab } from "@/components/app/statistics-charts/tabs/TrendTab"
import type { StatisticsChartsTabsProps } from "@/components/app/statistics-charts/tabs/types"
import { WellbeingTab } from "@/components/app/statistics-charts/tabs/WellbeingTab"

const TABS = [
  { value: "uebersicht", label: "Übersicht" },
  { value: "verlauf", label: "Verlauf" },
  { value: "trefferlage", label: "Trefferlage" },
  { value: "selbstbild", label: "Selbsteinschätzung" },
  { value: "befinden", label: "Befinden" },
  { value: "qualitaet", label: "Qualität & Schüsse" },
] as const

type Tab = (typeof TABS)[number]["value"]

const PANEL_ID = "statistics-tab"

// Der Umschalter scrollt am Telefon in sich, damit alle Statistikbereiche direkt erreichbar bleiben.
export function StatisticsChartsTabs({ model }: StatisticsChartsTabsProps) {
  const [tab, setTab] = useState<Tab>("uebersicht")

  return (
    <div className="grid min-w-0 gap-4">
      <Segmented
        label="Bereich"
        options={TABS}
        value={tab}
        onChange={setTab}
        controls={PANEL_ID}
        scroll
      />
      <div id={PANEL_ID} className="min-w-0">
        {tab === "uebersicht" && <OverviewTab model={model.overview} />}
        {tab === "verlauf" && <TrendTab model={model.trend} />}
        {tab === "trefferlage" && <HitLocationTab model={model.hitLocation} />}
        {tab === "selbstbild" && <SelfAssessmentTab model={model.selfAssessment} />}
        {tab === "befinden" && <WellbeingTab model={model.wellbeing} />}
        {tab === "qualitaet" && <QualityTab model={model.quality} />}
      </div>
    </div>
  )
}
