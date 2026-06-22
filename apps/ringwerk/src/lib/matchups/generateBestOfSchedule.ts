/**
 * Generiert einen Einfachrunden-Spielplan (Single Round-Robin) via Circle Method.
 *
 * Algorithmus:
 * - Bei ungerader Teilnehmerzahl: Dummy (null) hinzufügen → Freilos-Matchup
 * - Teilnehmer[0] fixiert, Rest rotiert im Kreis → n-1 Spieltage
 * - Nur die erste Runde (kein Heimrecht-Tausch / Rückrunde)
 */

export interface BestOfMatchup {
  homeId: string
  awayId: string | null // null = Freilos (BYE)
  roundIndex: number // 1-basiert (= Spieltag)
}

export function generateBestOfSchedule(participantIds: string[]): BestOfMatchup[] {
  if (participantIds.length < 2) {
    return []
  }

  // Bei ungerader Anzahl: Dummy (null) für Freilos
  const ids: (string | null)[] = [...participantIds]
  if (ids.length % 2 !== 0) {
    ids.push(null)
  }

  const n = ids.length
  const numRounds = n - 1 // Spieltage

  // Rotierender Teil (ids[0] bleibt fixiert)
  const rotating: (string | null)[] = ids.slice(1)

  const result: BestOfMatchup[] = []

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
        result.push({ homeId: realId, awayId: null, roundIndex })
        continue
      }

      // Normales Duell
      result.push({ homeId: a, awayId: b, roundIndex })
    }

    // Rotating-Array um eine Position nach rechts drehen
    rotating.unshift(rotating.pop()!)
  }

  return result
}
