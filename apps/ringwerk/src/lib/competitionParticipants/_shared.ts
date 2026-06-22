import { revalidatePath } from "next/cache"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"

export async function revalidateCompetitionParticipantPaths(competitionId: string): Promise<void> {
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePath("/competitions")
  await revalidatePublicSlugForCompetition(competitionId)
}
