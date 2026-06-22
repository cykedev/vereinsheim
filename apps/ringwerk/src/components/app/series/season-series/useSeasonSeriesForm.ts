import { useState, useActionState, useEffect } from "react"
import { saveSeasonSeries, updateSeasonSeries } from "@/lib/series/actions"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import type { ActionResult } from "@/lib/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"

export interface ExistingSeries {
  id: string
  rings: number
  teiler: number
  /** ISO-Datum (YYYY-MM-DD) */
  sessionDate: string
  disciplineId?: string | null
}

interface Discipline {
  id: string
  name: string
  scoringType: ScoringType
  teilerFaktor: number
}

interface Args {
  competitionId: string
  participantId: string
  scoringMode: ScoringMode
  disciplines?: Discipline[]
  defaultDisciplineId?: string | null
  existingSeries?: ExistingSeries
}

export function useSeasonSeriesForm({
  competitionId,
  participantId,
  scoringMode,
  disciplines,
  defaultDisciplineId,
  existingSeries,
}: Args) {
  const [open, setOpen] = useState(false)
  const isMixed = disciplines && disciplines.length > 0
  const isCorrection = !!existingSeries

  const initialDisciplineId =
    existingSeries?.disciplineId ?? defaultDisciplineId ?? disciplines?.[0]?.id ?? null
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(
    initialDisciplineId
  )

  const [sessionDate, setSessionDate] = useState<string>(
    existingSeries?.sessionDate ?? new Date().toISOString().slice(0, 10)
  )
  const [rings, setRings] = useState<string>(existingSeries ? String(existingSeries.rings) : "")
  const [teiler, setTeiler] = useState<string>(existingSeries ? String(existingSeries.teiler) : "")

  // Compute effective scoring type based on currently selected discipline
  const selectedDiscipline = disciplines?.find((d) => d.id === selectedDisciplineId) ?? null
  const effectiveScoringType = getEffectiveScoringType(scoringMode, selectedDiscipline)

  // teilerFaktor aus der gewählten Disziplin (für Live-Anzeige des korrigierten Teilers)
  const teilerFaktor = selectedDiscipline?.teilerFaktor ?? 1
  const teilerNum = parseFloat(teiler.replace(",", "."))
  const correctedTeiler = isNaN(teilerNum) || teilerFaktor === 1 ? null : teilerNum * teilerFaktor

  const boundAction = isCorrection
    ? updateSeasonSeries.bind(null, competitionId, existingSeries.id)
    : saveSeasonSeries.bind(null, competitionId, participantId)

  const [state, formAction, isPending] = useActionState(
    (prev: ActionResult | null, formData: FormData) => boundAction(prev, formData),
    null
  )

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  useEffect(() => {
    if (state && "success" in state && state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
    }
  }, [state])

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSessionDate(existingSeries?.sessionDate ?? new Date().toISOString().slice(0, 10))
      setRings(existingSeries ? String(existingSeries.rings) : "")
      setTeiler(existingSeries ? String(existingSeries.teiler) : "")
      setSelectedDisciplineId(initialDisciplineId)
    }
    setOpen(isOpen)
  }

  return {
    open,
    setOpen,
    isMixed,
    isCorrection,
    selectedDisciplineId,
    setSelectedDisciplineId,
    sessionDate,
    setSessionDate,
    rings,
    setRings,
    teiler,
    setTeiler,
    effectiveScoringType,
    correctedTeiler,
    formAction,
    isPending,
    fieldErrors,
    generalError,
    handleOpenChange,
  }
}

export type SeasonSeriesFormState = ReturnType<typeof useSeasonSeriesForm>
