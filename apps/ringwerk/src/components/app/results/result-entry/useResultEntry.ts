import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveMatchResult } from "@/lib/results/actions"
import type { MatchResultSummary } from "@/lib/matchups/types"

interface ParticipantResult {
  rings: string
  teiler: string
}

interface Args {
  matchupId: string
  homeParticipantId: string
  awayParticipantId: string
  existingResults: MatchResultSummary[]
}

function getExisting(
  results: MatchResultSummary[],
  participantId: string
): MatchResultSummary | undefined {
  return results.find((r) => r.participantId === participantId)
}

function fieldsFromExisting(existing: MatchResultSummary | undefined): ParticipantResult {
  return {
    rings: existing ? String(existing.rings) : "",
    teiler: existing ? String(existing.teiler) : "",
  }
}

export function useResultEntry({
  matchupId,
  homeParticipantId,
  awayParticipantId,
  existingResults,
}: Args) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const existingHome = getExisting(existingResults, homeParticipantId)
  const existingAway = getExisting(existingResults, awayParticipantId)

  const [home, setHome] = useState<ParticipantResult>(fieldsFromExisting(existingHome))
  const [away, setAway] = useState<ParticipantResult>(fieldsFromExisting(existingAway))

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setHome(fieldsFromExisting(existingHome))
      setAway(fieldsFromExisting(existingAway))
      setError(null)
    }
    setOpen(isOpen)
  }

  function handleSubmit() {
    const homeTotalRings = parseFloat(home.rings.replace(",", "."))
    const homeTeiler = parseFloat(home.teiler.replace(",", "."))
    const awayTotalRings = parseFloat(away.rings.replace(",", "."))
    const awayTeiler = parseFloat(away.teiler.replace(",", "."))

    if (isNaN(homeTotalRings) || isNaN(homeTeiler) || isNaN(awayTotalRings) || isNaN(awayTeiler)) {
      setError("Alle Felder müssen ausgefüllt sein.")
      return
    }

    if (homeTotalRings < 0 || awayTotalRings < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }

    if (homeTeiler < 0 || awayTeiler < 0) {
      setError("Teiler müssen positiv sein.")
      return
    }

    setOpen(false)

    startTransition(async () => {
      const result = await saveMatchResult(matchupId, {
        homeResult: { rings: homeTotalRings, teiler: homeTeiler },
        awayResult: { rings: awayTotalRings, teiler: awayTeiler },
      })

      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      }
    })
  }

  return {
    open,
    setOpen,
    isPending,
    error,
    home,
    setHome,
    away,
    setAway,
    handleOpen,
    handleSubmit,
  }
}

export type ResultEntryState = ReturnType<typeof useResultEntry>
