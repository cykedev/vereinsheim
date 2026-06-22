import { useState } from "react"
import type { CompetitionDetail } from "@/lib/competitions/types"

// Regelset-bezogener Formularstatus (Liga-Format, Gruppenphase, Playoffs, Finale).
export function useRulesetState(competition?: CompetitionDetail) {
  const [finalePrimary, setFinalePrimary] = useState<string>(competition?.finalePrimary ?? "RINGS")
  const [finaleTiebreaker1, setFinaleTiebreaker1] = useState<string>(
    competition?.finaleTiebreaker1 ?? "none"
  )
  const [finaleTiebreaker2, setFinaleTiebreaker2] = useState<string>(
    competition?.finaleTiebreaker2 ?? "none"
  )
  const [finaleHasSuddenDeath, setFinaleHasSuddenDeath] = useState<boolean>(
    competition?.finaleHasSuddenDeath ?? true
  )

  const [leagueFormat, setLeagueFormat] = useState<string>(
    competition?.leagueFormat ?? "DOUBLE_ROUND_ROBIN"
  )
  const [groupBestOf, setGroupBestOf] = useState<string>(String(competition?.groupBestOf ?? 3))
  const [groupPlayAllDuels, setGroupPlayAllDuels] = useState<boolean>(
    competition?.groupPlayAllDuels ?? true
  )
  const [groupTiebreaker1, setGroupTiebreaker1] = useState<string>(
    competition?.groupTiebreaker1 ?? "none"
  )
  const [groupTiebreaker2, setGroupTiebreaker2] = useState<string>(
    competition?.groupTiebreaker2 ?? "none"
  )
  const [groupHasSuddenDeath, setGroupHasSuddenDeath] = useState<boolean>(
    competition?.groupHasSuddenDeath ?? true
  )

  const [playoffBestOf, setPlayoffBestOf] = useState<string>(
    String(competition?.playoffBestOf ?? 5)
  )
  const [playoffHasViertelfinale, setPlayoffHasViertelfinale] = useState<boolean>(
    competition?.playoffHasViertelfinale ?? true
  )
  const [playoffHasAchtelfinale, setPlayoffHasAchtelfinale] = useState<boolean>(
    competition?.playoffHasAchtelfinale ?? false
  )

  const isBestOfSingle = leagueFormat === "BEST_OF_SINGLE"

  return {
    finalePrimary,
    setFinalePrimary,
    finaleTiebreaker1,
    setFinaleTiebreaker1,
    finaleTiebreaker2,
    setFinaleTiebreaker2,
    finaleHasSuddenDeath,
    setFinaleHasSuddenDeath,
    leagueFormat,
    setLeagueFormat,
    groupBestOf,
    setGroupBestOf,
    groupPlayAllDuels,
    setGroupPlayAllDuels,
    groupTiebreaker1,
    setGroupTiebreaker1,
    groupTiebreaker2,
    setGroupTiebreaker2,
    groupHasSuddenDeath,
    setGroupHasSuddenDeath,
    playoffBestOf,
    setPlayoffBestOf,
    playoffHasViertelfinale,
    setPlayoffHasViertelfinale,
    playoffHasAchtelfinale,
    setPlayoffHasAchtelfinale,
    isBestOfSingle,
  }
}
