import { Card, CardContent } from "@vereinsheim/ui/design2/card"
import type { OverviewTableGroup } from "@/lib/stats/overview/aggregateOverview"
import { DisciplineOverviewTable } from "./overview"

interface Props {
  model: {
    groups: OverviewTableGroup[]
  }
}

export function OverviewTab({ model }: Props) {
  const { groups } = model

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Einheiten mit Ergebnis für den gewählten Filter.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <DisciplineOverviewTable key={group.disciplineId} group={group} />
        ))}
      </div>
    </div>
  )
}
