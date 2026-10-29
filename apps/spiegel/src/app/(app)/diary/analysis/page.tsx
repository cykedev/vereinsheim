import type { Metadata } from "next"

import { analysisView } from "@/diary/analysis/queries"
import { AnalysisScreen } from "@/diary/components/AnalysisScreen"
import { requireDiary } from "@/diary/page-guard"
import { db } from "@/lib/db"

export const metadata: Metadata = { title: "Auswertung" }

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null)

// Auswertung: Einflüsse und Selbstbild je Disziplin (`?family=`) und Zeitraum (`?season=2025`, ohne: „Alles“)
export default async function AnalysisRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId, timeZone } = await requireDiary()
  const params = await searchParams
  const view = await analysisView(
    db,
    userId,
    { family: one(params.family), season: one(params.season) },
    timeZone
  )
  return <AnalysisScreen view={view} timeZone={timeZone} />
}
