/**
 * Einfachrunde „jeder gegen jeden“ mit ausgeglichener A/B-Verteilung.
 *
 * Konstruktion: kanonische 1-Faktorisierung (Berger-Tabelle, de Werra). Die Teilnehmer
 * `0 … m-1` (`m = n-1`) stehen im Kreis, der letzte (`∞`) ist fest. In Runde `r` (0-basiert):
 * - `∞` spielt gegen `r`; `∞` ist A in geraden Runden, sonst B.
 * - für `i = 1 … n/2-1` spielen `(r+i) mod m` und `(r-i) mod m`; A ist `(r+i)` bei ungeradem `i`,
 *   sonst `(r-i)`.
 *
 * Ergebnis: bei ungerader Teilnehmerzahl ist jeder genau gleich oft A wie B, bei gerader
 * höchstens einmal öfter (mehr geht nicht — jeder hat dann `n-1`, also ungerade viele Begegnungen).
 * Die Paritätsregel (A wechselt mit `i`) sorgt zusätzlich dafür, dass die Seiten abwechseln: nie
 * zweimal hintereinander dieselbe Seite bei ungerader Zahl, insgesamt nur das Minimum von `n-2`
 * Wiederholungen bei gerader (de Werra). „Immer `r+i` ist A“ wäre ebenfalls ausgeglichen, stellte
 * aber z.B. bei 16 Teilnehmern jemanden 8× in Folge auf A — die Regel nicht „vereinfachen“.
 * Die frühere Circle-Method hielt den festen Teilnehmer in jeder Runde links, er war also immer A.
 *
 * Bei ungerader Teilnehmerzahl ist `∞` ein Dummy; seine Begegnung ist das Freilos
 * (`awayId = null`, `homeId` = der echte Teilnehmer) — jeder erhält genau eines.
 */

export interface RoundRobinMatch {
  homeId: string
  awayId: string | null // null = Freilos (BYE)
  roundIndex: number // 1-basiert (= Spieltag)
}

export function roundRobinRounds(participantIds: string[]): RoundRobinMatch[] {
  if (participantIds.length < 2) {
    return []
  }

  // Bei ungerader Anzahl: Dummy (null) als fester Teilnehmer → Freilos
  const ids: (string | null)[] = [...participantIds]
  if (ids.length % 2 !== 0) {
    ids.push(null)
  }

  const n = ids.length
  const m = n - 1 // Kreisgröße = Spieltage
  const fixed = ids[m]
  const result: RoundRobinMatch[] = []

  for (let r = 0; r < m; r++) {
    const roundIndex = r + 1

    // `null` steht nur auf Index `m` (fester Platz); die Kreisindizes sind `mod m` → nie `null`.
    const opponent = ids[r] as string
    if (fixed === null) {
      result.push({ homeId: opponent, awayId: null, roundIndex })
    } else if (r % 2 === 0) {
      result.push({ homeId: fixed, awayId: opponent, roundIndex })
    } else {
      result.push({ homeId: opponent, awayId: fixed, roundIndex })
    }

    for (let i = 1; i < n / 2; i++) {
      const up = ids[(r + i) % m] as string
      const down = ids[(r - i + m) % m] as string
      result.push(
        i % 2 === 1
          ? { homeId: up, awayId: down, roundIndex }
          : { homeId: down, awayId: up, roundIndex }
      )
    }
  }

  return result
}
