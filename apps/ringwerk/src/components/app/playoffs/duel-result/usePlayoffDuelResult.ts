import { useState } from "react"
import { useRouter } from "next/navigation"
import { savePlayoffDuelResult } from "@/lib/playoffs/actions"
import { finaleNeedsTeiler } from "@/lib/playoffs/calculatePlayoffs"
import type { PlayoffDuelItem } from "@/lib/playoffs/types"
import type { ScoringMode } from "@/generated/prisma/client"

interface ResultFields {
  totalRings: string
  teiler: string
}

interface Args {
  duel: PlayoffDuelItem
  isCorrection: boolean
  isFinalMatch: boolean
  shotsPerSeries: number
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
}

function fieldsFromResult(result: PlayoffDuelItem["resultA"]): ResultFields {
  return {
    totalRings: result ? String(result.totalRings) : "",
    teiler: result?.teiler != null ? String(result.teiler) : "",
  }
}

export function usePlayoffDuelResult({
  duel,
  isCorrection,
  isFinalMatch,
  shotsPerSeries,
  finalePrimary,
  finaleTiebreaker1,
  finaleTiebreaker2,
}: Args) {
  // Teiler anzeigen: immer bei VF/HF; im Finale nur wenn ein Kriterium Teiler erfordert
  const showTeiler =
    !isFinalMatch || finaleNeedsTeiler(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fieldA, setFieldA] = useState<ResultFields>(fieldsFromResult(duel.resultA))
  const [fieldB, setFieldB] = useState<ResultFields>(fieldsFromResult(duel.resultB))

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setFieldA(fieldsFromResult(duel.resultA))
      setFieldB(fieldsFromResult(duel.resultB))
      setError(null)
    }
    setOpen(isOpen)
  }

  async function handleSubmit() {
    const totalRingsA = parseFloat(fieldA.totalRings.replace(",", "."))
    const totalRingsB = parseFloat(fieldB.totalRings.replace(",", "."))

    if (isNaN(totalRingsA) || isNaN(totalRingsB)) {
      setError("Gesamtringe müssen ausgefüllt sein.")
      return
    }
    if (totalRingsA < 0 || totalRingsB < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }

    let teilerA: number | undefined
    let teilerB: number | undefined

    if (showTeiler) {
      teilerA = parseFloat(fieldA.teiler.replace(",", "."))
      teilerB = parseFloat(fieldB.teiler.replace(",", "."))
      if (isNaN(teilerA) || isNaN(teilerB)) {
        setError("Teiler müssen ausgefüllt sein.")
        return
      }
      if (teilerA < 0 || teilerB < 0) {
        setError("Teiler müssen positiv sein.")
        return
      }
    }

    setError(null)

    setSubmitting(true)
    const result = await savePlayoffDuelResult({
      duelId: duel.id,
      totalRingsA,
      teilerA,
      totalRingsB,
      teilerB,
    })
    setSubmitting(false)

    if ("error" in result) {
      setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      return
    }
    setOpen(false)
    // router.refresh() outside a transition so the result reliably appears on the card.
    router.refresh()
  }

  const shotLabel = `${shotsPerSeries} Schüsse`
  const title = isFinalMatch
    ? duel.isSuddenDeath
      ? "Verlängerung eintragen"
      : isCorrection
        ? `${shotLabel} korrigieren`
        : `${shotLabel} eintragen`
    : duel.isSuddenDeath
      ? "Entscheidungsduell eintragen"
      : isCorrection
        ? `Duell ${duel.duelNumber} korrigieren`
        : `Duell ${duel.duelNumber} eintragen`

  return {
    showTeiler,
    open,
    setOpen,
    submitting,
    error,
    fieldA,
    setFieldA,
    fieldB,
    setFieldB,
    handleOpen,
    handleSubmit,
    title,
  }
}

export type PlayoffDuelResultState = ReturnType<typeof usePlayoffDuelResult>
