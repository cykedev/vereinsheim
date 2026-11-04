import { Pencil } from "lucide-react"
import type { CompetitionStatus } from "@/generated/prisma/client"
import { offersEdit } from "@/lib/competitions/editable"

import { DetailNavButton } from "./CompetitionDetailHeader"

/**
 * „Bearbeiten“ in der Leiste der Ergebnis-Seite eines Wettbewerbs (Rangliste, Rangliste der Saison, Spielplan und
 * Playoffs der Liga): für die Sportleitung, nicht bei archivierten Wettbewerben (`offersEdit`, wie in der Übersicht).
 */
export function EditCompetitionButton({
  id,
  status,
  canManage,
}: {
  id: string
  status: CompetitionStatus
  canManage: boolean
}) {
  if (!canManage || !offersEdit(status)) return null
  return <DetailNavButton href={`/competitions/${id}/edit`} label="Bearbeiten" icon={Pencil} />
}
