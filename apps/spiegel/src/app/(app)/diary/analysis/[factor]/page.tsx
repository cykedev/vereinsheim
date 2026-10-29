import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { WELLBEING_ASPECTS, type WellbeingAspect } from "@/diary/analysis/influences"
import { factorView } from "@/diary/analysis/queries"
import { ASPECT_WORDS } from "@/diary/analysis/texts"
import { FactorScreen } from "@/diary/components/FactorScreen"
import { requireDiary } from "@/diary/page-guard"
import { ANALYSIS_PATH } from "@/diary/paths"
import { db } from "@/lib/db"

const isAspect = (value: string): value is WellbeingAspect =>
  (WELLBEING_ASPECTS as readonly string[]).includes(value)

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ factor: string }>
}): Promise<Metadata> {
  const { factor } = await params
  return { title: isAspect(factor) ? ASPECT_WORDS[factor].name : "Auswertung" }
}

// die Seite eines Merkmals der Einflüsse (`sleep`, `energy`, `stress`, `motivation`) mit Disziplin und Zeitraum der
// Auswertung; ohne Disziplin mit Einträgen zurück in die Auswertung
export default async function FactorRoute({
  params,
  searchParams,
}: {
  params: Promise<{ factor: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { factor } = await params
  if (!isAspect(factor)) notFound()
  const { userId, timeZone } = await requireDiary()
  const query = await searchParams
  const view = await factorView(
    db,
    userId,
    { aspect: factor, family: one(query.family), season: one(query.season) },
    timeZone
  )
  if (!view) redirect(ANALYSIS_PATH)
  return <FactorScreen view={view} timeZone={timeZone} />
}
