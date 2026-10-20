import { notFound, redirect } from "next/navigation"
import { getCompetitionById } from "@/lib/competitions/queries"
import { hasPlayoffsStarted } from "@/lib/playoffs/queries"
import { competitionPageHref, entryPage } from "@/components/app/shell/competitionPages"

interface Props {
  params: Promise<{ id: string }>
}

// Der Einstieg in einen Wettbewerb führt zu der Seite, die zeigt, wie es gerade steht (`entryPage`)
export default async function CompetitionPage({ params }: Props) {
  const { id } = await params
  const competition = await getCompetitionById(id)
  if (!competition) notFound()

  const playoffsStarted = competition.type === "LEAGUE" && (await hasPlayoffsStarted(id))
  redirect(competitionPageHref(id, entryPage(competition.type, playoffsStarted)))
}
