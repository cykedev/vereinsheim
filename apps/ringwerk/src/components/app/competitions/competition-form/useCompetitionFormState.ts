import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { ActionResult } from "@/lib/types"
import { slugify } from "@/lib/competitions/publicSlug"
import { getFieldError, getGeneralError } from "@/lib/forms/fieldErrors"
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard"
import { useNavigationConfirm } from "@/lib/hooks/useNavigationConfirm"
import { BEST_OF_DUEL_MODES, toDateInputValue } from "./constants"
import { useRulesetState } from "./useRulesetState"

interface Args {
  competition?: CompetitionDetail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: ActionResult<any> | null, formData: FormData) => Promise<ActionResult<any>>
}

export function useCompetitionFormState({ competition, action }: Args) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)
  const isEdit = !!competition
  // true, sobald der Nutzer ein Feld geändert hat (für den Datenverlust-Schutz).
  const [dirty, setDirty] = useState(false)
  // true, sobald abgeschickt wurde — verhindert, dass der Erfolgs-Redirect blockiert wird.
  const [submitted, setSubmitted] = useState(false)
  function markDirty() {
    if (!dirty) setDirty(true)
  }

  const ruleset = useRulesetState(competition)
  const { isBestOfSingle, setLeagueFormat } = ruleset

  const [type, setType] = useState<string>(competition?.type ?? "LEAGUE")
  const [scoringMode, setScoringMode] = useState<string>(competition?.scoringMode ?? "RINGTEILER")
  const [allowGuests, setAllowGuests] = useState<boolean>(competition?.allowGuests ?? false)
  const [teamSize, setTeamSize] = useState<string>(String(competition?.teamSize ?? ""))

  const [name, setName] = useState<string>(competition?.name ?? "")
  const [shotsPerSeries, setShotsPerSeries] = useState<string>(
    String(competition?.shotsPerSeries ?? 10)
  )
  const [disciplineId, setDisciplineId] = useState<string>(competition?.disciplineId ?? "mixed")
  const [minSeries, setMinSeries] = useState<string>(
    competition?.minSeries != null ? String(competition.minSeries) : ""
  )
  const [seasonStart, setSeasonStart] = useState<string>(toDateInputValue(competition?.seasonStart))
  const [seasonEnd, setSeasonEnd] = useState<string>(toDateInputValue(competition?.seasonEnd))
  const [hinrundeDeadline, setHinrundeDeadline] = useState<string>(
    toDateInputValue(competition?.hinrundeDeadline)
  )
  const [rueckrundeDeadline, setRueckrundeDeadline] = useState<string>(
    toDateInputValue(competition?.rueckrundeDeadline)
  )
  const [eventDate, setEventDate] = useState<string>(toDateInputValue(competition?.eventDate))
  const [teamScoring, setTeamScoring] = useState<string>(competition?.teamScoring ?? "SUM")
  const [targetValue, setTargetValue] = useState<string>(
    competition?.targetValue != null ? String(competition.targetValue) : ""
  )
  const [targetValueType, setTargetValueType] = useState<string>(
    competition?.targetValueType ?? "RINGS"
  )

  const [isPublic, setIsPublic] = useState<boolean>(competition?.isPublic ?? false)
  const [publicSlug, setPublicSlug] = useState<string>(competition?.publicSlug ?? "")
  const [publicPassword, setPublicPassword] = useState<string>("")
  const [removePublicPassword, setRemovePublicPassword] = useState<boolean>(false)

  const hasExistingPassword = competition?.hasPublicPassword ?? false

  useEffect(() => {
    if (state && "success" in state && state.success) {
      toast.success("Wettbewerb gespeichert.")
      const id = (state.data as { id?: string } | undefined)?.id
      if (id) {
        router.push(`/competitions/${id}/participants`)
      } else {
        router.push("/competitions")
      }
    } else if (state && "error" in state && typeof state.error === "string") {
      toast.error(state.error)
    }
  }, [state, router])

  // Datenverlust-Schutz: aktiv, solange Änderungen bestehen und nicht abgeschickt wurde.
  const isDirty = dirty && !submitted
  useUnsavedChangesGuard({ enabled: isDirty && !isPending })
  const nav = useNavigationConfirm({ isDirty: isDirty && !isPending })

  // When the user first turns the publish switch on, pre-fill the slug from the name
  // (only if the slug input is currently empty). Subsequent edits are left alone.
  useEffect(() => {
    if (isPublic && publicSlug.trim() === "" && name) {
      setPublicSlug(slugify(name)) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isPublic]) // eslint-disable-line react-hooks/exhaustive-deps

  const nameError = getFieldError(state, "name")
  const disciplineIdError = getFieldError(state, "disciplineId")
  const generalError = getGeneralError(state)

  const isTargetMode =
    scoringMode === "TARGET_ABSOLUTE" ||
    scoringMode === "TARGET_UNDER" ||
    scoringMode === "TARGET_OVER"

  // Beim Wechsel auf BEST_OF_SINGLE den Wertungsmodus zurücksetzen, falls
  // er im Direktduell nicht erlaubt ist.
  function onLeagueFormatChange(v: string) {
    setLeagueFormat(v)
    if (v === "BEST_OF_SINGLE" && !BEST_OF_DUEL_MODES.includes(scoringMode)) {
      setScoringMode("RINGTEILER")
    }
  }

  return {
    ...ruleset,
    router,
    formAction,
    isPending,
    isEdit,
    markDirty,
    setSubmitted,
    nav,
    onLeagueFormatChange,
    isBestOfSingle,
    type,
    setType,
    scoringMode,
    setScoringMode,
    allowGuests,
    setAllowGuests,
    teamSize,
    setTeamSize,
    name,
    setName,
    shotsPerSeries,
    setShotsPerSeries,
    disciplineId,
    setDisciplineId,
    minSeries,
    setMinSeries,
    seasonStart,
    setSeasonStart,
    seasonEnd,
    setSeasonEnd,
    hinrundeDeadline,
    setHinrundeDeadline,
    rueckrundeDeadline,
    setRueckrundeDeadline,
    eventDate,
    setEventDate,
    teamScoring,
    setTeamScoring,
    targetValue,
    setTargetValue,
    targetValueType,
    setTargetValueType,
    isPublic,
    setIsPublic,
    publicSlug,
    setPublicSlug,
    publicPassword,
    setPublicPassword,
    removePublicPassword,
    setRemovePublicPassword,
    hasExistingPassword,
    nameError,
    disciplineIdError,
    generalError,
    isTargetMode,
  }
}

export type CompetitionFormState = ReturnType<typeof useCompetitionFormState>
