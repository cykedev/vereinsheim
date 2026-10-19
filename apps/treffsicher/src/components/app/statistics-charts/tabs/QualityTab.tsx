import { Card, CardContent } from "@vereinsheim/ui/design2/card"
import { QualityScatterCard } from "@/components/app/statistics-charts/tabs/quality/QualityScatterCard"
import { ShotDistributionTimelineCard } from "@/components/app/statistics-charts/tabs/quality/ShotDistributionTimelineCard"
import type { QualityTabModel } from "@/components/app/statistics-charts/tabs/types"

interface Props {
  model: QualityTabModel
}

export function QualityTab({ model }: Props) {
  const hasAnyData =
    model.scatter.filteredQualityCount > 1 || model.distribution.shotDistributionTimeline.length > 0

  return (
    <div className="space-y-4">
      {hasAnyData ? (
        <>
          <QualityScatterCard model={model.scatter} />
          <ShotDistributionTimelineCard model={model.distribution} />
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Qualitäts- oder Schussverteilungs-Daten für den gewählten Filter.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
