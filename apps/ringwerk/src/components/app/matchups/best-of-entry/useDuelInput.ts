import { useState, useTransition } from "react"
import {
  saveBestOfDuel,
  saveStechschuss,
  deleteLatestBestOfDuel,
} from "@/lib/results/bestOfActions"

interface Args {
  matchupId: string
  nextDuelNumber: number
}

// Eingabe-Status und Speicher-/Lösch-Handler für ein Best-of-Duell.
export function useDuelInput({ matchupId, nextDuelNumber }: Args) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Duel input state
  const [homeRings, setHomeRings] = useState("")
  const [homeTeiler, setHomeTeiler] = useState("")
  const [awayRings, setAwayRings] = useState("")
  const [awayTeiler, setAwayTeiler] = useState("")

  // Stechschuss input state
  const [homeShot, setHomeShot] = useState("")
  const [awayShot, setAwayShot] = useState("")

  function resetInputs() {
    setHomeRings("")
    setHomeTeiler("")
    setAwayRings("")
    setAwayTeiler("")
    setHomeShot("")
    setAwayShot("")
    setError(null)
  }

  function handleSaveDuel() {
    const ringsH = parseFloat(homeRings.replace(",", "."))
    const teilerH = parseFloat(homeTeiler.replace(",", "."))
    const ringsA = parseFloat(awayRings.replace(",", "."))
    const teilerA = parseFloat(awayTeiler.replace(",", "."))

    if (isNaN(ringsH) || isNaN(teilerH) || isNaN(ringsA) || isNaN(teilerA)) {
      setError("Alle Felder (Ringe + Teiler) müssen ausgefüllt sein.")
      return
    }
    if (ringsH < 0 || ringsA < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }
    if (teilerH <= 0 || teilerA <= 0) {
      setError("Teiler müssen größer als 0 sein.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await saveBestOfDuel({
        matchupId,
        duelNumber: nextDuelNumber,
        homeResult: { rings: ringsH, teiler: teilerH },
        awayResult: { rings: ringsA, teiler: teilerA },
      })
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      } else {
        setHomeRings("")
        setHomeTeiler("")
        setAwayRings("")
        setAwayTeiler("")
      }
    })
  }

  function handleSaveStechschuss() {
    const shotH = parseFloat(homeShot.replace(",", "."))
    const shotA = parseFloat(awayShot.replace(",", "."))

    if (isNaN(shotH) || isNaN(shotA)) {
      setError("Beide Schusswerte müssen ausgefüllt sein.")
      return
    }
    if (shotH < 0 || shotA < 0) {
      setError("Schusswerte müssen positiv sein.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await saveStechschuss({ matchupId, homeShot: shotH, awayShot: shotA })
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      } else {
        setHomeShot("")
        setAwayShot("")
      }
    })
  }

  function handleDeleteLatest() {
    startTransition(async () => {
      const result = await deleteLatestBestOfDuel(matchupId)
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Zurücknehmen.")
      }
      setConfirmDelete(false)
    })
  }

  return {
    confirmDelete,
    setConfirmDelete,
    isPending,
    error,
    homeRings,
    setHomeRings,
    homeTeiler,
    setHomeTeiler,
    awayRings,
    setAwayRings,
    awayTeiler,
    setAwayTeiler,
    homeShot,
    setHomeShot,
    awayShot,
    setAwayShot,
    resetInputs,
    handleSaveDuel,
    handleSaveStechschuss,
    handleDeleteLatest,
  }
}
