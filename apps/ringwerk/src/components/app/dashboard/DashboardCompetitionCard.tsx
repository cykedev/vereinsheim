import Link from "next/link"
import { Badge } from "@vereinsheim/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@vereinsheim/ui/card"
import {
  CompetitionPreviewBadges,
  CompetitionPreviewSection,
} from "@/components/app/competitions/CompetitionPreview"
import type { CompetitionPreview } from "@/lib/competitions/previewModel"

interface Props {
  preview: CompetitionPreview
}

// Ein aktiver Wettbewerb auf dem Dashboard: Kopf mit verlinktem Namen (§7: keine zusätzlichen
// "Details →"-Buttons), darunter eine gekürzte Tabelle bzw. das Playoff-Bracket.
export function DashboardCompetitionCard({ preview }: Props) {
  const c = preview.competition
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="text-lg">
          <Link href={preview.href} className="hover:underline">
            {c.name}
          </Link>
        </CardTitle>
        <Badge variant="secondary" className="text-xs">
          {c.discipline?.name ?? "Gemischt"}
        </Badge>
        <CompetitionPreviewBadges preview={preview} />
      </CardHeader>
      <CardContent>
        <CompetitionPreviewSection preview={preview} />
      </CardContent>
    </Card>
  )
}
