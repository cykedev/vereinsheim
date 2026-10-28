import type { Metadata } from "next"

import { RoutineForm } from "@/diary/components/RoutineForm"
import { requireDiary } from "@/diary/page-guard"
import { db } from "@/lib/db"
import { resultFamilies } from "@/lib/results-read"

export const metadata: Metadata = { title: "Neuer Ablauf" }

// Neuer Ablauf: die Disziplin aus dem Faden vorgewählt (`?family=`)
export default async function NewRoutineRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId } = await requireDiary()
  const slug = (await searchParams).family
  const families = await resultFamilies(db, userId)
  const familyId = families.find((f) => f.slug === slug)?.id ?? null
  return <RoutineForm routine={null} families={families} familyId={familyId} />
}
