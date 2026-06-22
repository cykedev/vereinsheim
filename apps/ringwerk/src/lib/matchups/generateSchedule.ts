/**
 * Generiert einen Doppelrunden-Spielplan (Hin- + Rückrunde) via Circle Method.
 *
 * Algorithmus:
 * - Bei ungerader Teilnehmerzahl: Dummy (null) hinzufügen → Freilos-Matchup
 * - Teilnehmer[0] fixiert, Rest rotiert im Kreis → n-1 Spieltage (Hinrunde)
 * - Rückrunde: Heimrecht getauscht (home ↔ away)
 */

export interface ScheduledMatchup {
  homeId: string
  awayId: string | null // null = Freilos (BYE)
  round: "FIRST_LEG" | "SECOND_LEG"
  roundIndex: number // 1-basiert innerhalb der Runde (= Spieltag)
}

export function generateSchedule(participantIds: string[]): ScheduledMatchup[] {
  if (participantIds.length < 2) {
    return []
  }

  // Bei ungerader Anzahl: Dummy (null) für Freilos
  const ids: (string | null)[] = [...participantIds]
  if (ids.length % 2 !== 0) {
    ids.push(null)
  }

  const n = ids.length
  const numRounds = n - 1 // Spieltage pro Runde

  // Rotierender Teil (ids[0] bleibt fixiert)
  const rotating: (string | null)[] = ids.slice(1)

  const firstLeg: ScheduledMatchup[] = []
  const secondLeg: ScheduledMatchup[] = []

  for (let r = 0; r < numRounds; r++) {
    const roundIndex = r + 1

    // Aktuelle Reihenfolge: [ids[0], ...rotating]
    const current: (string | null)[] = [ids[0], ...rotating]

    // Paarungen: current[i] vs current[n-1-i]
    for (let i = 0; i < n / 2; i++) {
      const a = current[i]
      const b = current[n - 1 - i]

      if (a === null && b === null) continue

      // Freilos: einer der beiden ist null
      if (a === null || b === null) {
        const realId = (a ?? b) as string
        firstLeg.push({
          homeId: realId,
          awayId: null,
          round: "FIRST_LEG",
          roundIndex,
        })
        // Rückrunde: Freilos bleibt gleich (kein Heimrecht-Tausch sinnvoll)
        secondLeg.push({
          homeId: realId,
          awayId: null,
          round: "SECOND_LEG",
          roundIndex,
        })
        continue
      }

      // Normales Duell
      firstLeg.push({
        homeId: a,
        awayId: b,
        round: "FIRST_LEG",
        roundIndex,
      })
      // Rückrunde: Heimrecht getauscht
      secondLeg.push({
        homeId: b,
        awayId: a,
        round: "SECOND_LEG",
        roundIndex,
      })
    }

    // Rotating-Array um eine Position nach rechts drehen
    rotating.unshift(rotating.pop()!)
  }

  return [...firstLeg, ...secondLeg]
}
