import { revalidatePath } from "next/cache"
import { revalidatePublicPdf } from "@/lib/competitions/publicPdfCache"

export function revalidateCompetitionParticipantPaths(competitionId: string): void {
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePath("/competitions")
  revalidatePublicPdf(competitionId)
}
