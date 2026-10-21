// Merkmale eines Wettbewerbs aus der Datenbank: was nachweislich darin steht, unabhängig davon, wie `build.ts` es
// erzeugt hat. Für Tabellenplätze und den direkten Vergleich zählt Ringwerks eigene Tabellen-Abfrage.

import { determineOutcome } from "@/lib/results/calculateResult"
import { duelOutcome } from "@/lib/scoring/bestOf"

import type { Ringwerk } from "./ringwerk"
import type { Fact, Scenario } from "./scenarios"

const ROUND_ORDER = ["EIGHTH_FINAL", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"]

export async function factsOf(rw: Ringwerk, competitionId: string): Promise<Set<Fact>> {
  const c = await rw.db.competition.findUniqueOrThrow({
    where: { id: competitionId },
    select: {
      type: true,
      status: true,
      leagueFormat: true,
      scoringMode: true,
      groupTiebreaker1: true,
      groupTiebreaker2: true,
      isPublic: true,
      publicPasswordHash: true,
      publicAccessToken: true,
      disciplineId: true,
      discipline: { select: { isArchived: true } },
      minSeries: true,
      targetValue: true,
      targetValueType: true,
      participants: {
        select: {
          id: true,
          participantId: true,
          status: true,
          startNumber: true,
          isGuest: true,
          exemptFromMinSeries: true,
          eventTeamId: true,
          discipline: { select: { teilerFaktor: true } },
          participant: { select: { lastName: true, isActive: true } },
        },
      },
      matchups: {
        select: {
          status: true,
          round: true,
          dueDate: true,
          homeParticipantId: true,
          awayParticipantId: true,
          series: {
            select: {
              duelNumber: true,
              isTiebreak: true,
              participantId: true,
              rings: true,
              teiler: true,
              ringteiler: true,
            },
          },
        },
      },
      playoffMatches: {
        select: {
          round: true,
          status: true,
          winsA: true,
          winsB: true,
          participantAId: true,
          participantBId: true,
          duels: {
            select: {
              isSuddenDeath: true,
              isCompleted: true,
              results: { select: { participantId: true, totalRings: true, ringteiler: true } },
            },
          },
        },
      },
      series: {
        select: {
          participantId: true,
          competitionParticipantId: true,
          rings: true,
          teiler: true,
        },
      },
    },
  })

  const facts = new Set<Fact>()
  const add = (fact: Fact, condition: boolean) => {
    if (condition) facts.add(fact)
  }

  add("status:ACTIVE", c.status === "ACTIVE")
  add("status:COMPLETED", c.status === "COMPLETED")
  add("status:ARCHIVED", c.status === "ARCHIVED")
  add("oeffentlich:offen", c.isPublic && c.publicPasswordHash === null)
  add("oeffentlich:passwort", c.isPublic && c.publicPasswordHash !== null)
  add("oeffentlich:qr", c.isPublic && c.publicAccessToken !== null)

  const enrolled = c.participants
  const active = enrolled.filter((cp) => cp.status === "ACTIVE")
  const withdrawn = new Set(
    enrolled.filter((cp) => cp.status === "WITHDRAWN").map((cp) => cp.participantId)
  )
  add("teilnehmer:keine", enrolled.length === 0)
  add("teilnehmer:da", enrolled.length > 0)
  add("teilnehmer:gerade", active.length > 0 && active.length % 2 === 0)
  add("teilnehmer:ungerade", active.length % 2 === 1)
  add("teilnehmer:16", active.length === 16)
  add(
    "namen:lang",
    enrolled.some((cp) => cp.participant.lastName.length >= 18)
  )
  add(
    "teilnehmer:inaktiv",
    enrolled.some((cp) => !cp.participant.isActive)
  )
  add("disziplin:archiviert", c.discipline?.isArchived === true)
  add(
    "faktor",
    c.disciplineId === null &&
      new Set(
        enrolled.flatMap((cp) => (cp.discipline ? [cp.discipline.teilerFaktor.toString()] : []))
      ).size >= 2
  )

  // Liga: Gruppenphase
  const m = c.matchups
  const open = (x: (typeof m)[number]) => x.status === "PENDING" && x.awayParticipantId !== null
  const touchesWithdrawn = (x: (typeof m)[number]) =>
    withdrawn.has(x.homeParticipantId) ||
    (x.awayParticipantId !== null && withdrawn.has(x.awayParticipantId))
  add("spielplan:keiner", m.length === 0)
  add("spielplan:da", m.length > 0)
  add(
    "ergebnis:keines",
    m.length > 0 &&
      m.every((x) => x.series.length === 0 && x.status !== "COMPLETED" && x.status !== "WALKOVER")
  )
  add("paarung:offen", m.some(open))
  add(
    "paarung:fertig",
    m.some((x) => x.status === "COMPLETED")
  )
  add(
    "paarung:freilos",
    m.some((x) => x.status === "BYE")
  )
  add(
    "paarung:kampflos",
    m.some((x) => x.status === "WALKOVER")
  )
  add(
    "fristen",
    m.some((x) => x.dueDate !== null)
  )
  const firstLeg = m.filter((x) => x.round === "FIRST_LEG")
  const secondLeg = m.filter((x) => x.round === "SECOND_LEG")
  add("hinrunde:teilweise", firstLeg.some((x) => x.status === "COMPLETED") && firstLeg.some(open))
  add(
    "rueckrunde:teilweise",
    !firstLeg.some(open) && secondLeg.some((x) => x.status === "COMPLETED") && secondLeg.some(open)
  )
  add("gruppe:fertig", m.length > 0 && !m.some((x) => open(x) && !touchesWithdrawn(x)))
  add(
    "rueckzug:offene-paarungen",
    m.some((x) => open(x) && touchesWithdrawn(x))
  )
  add(
    "bestof:1-0-offen",
    m.some((x) => {
      const regular = x.series.filter((s) => !s.isTiebreak)
      if (!open(x) || regular.length !== 2 || !regular.every((s) => s.duelNumber === 1))
        return false
      const [a, b] = regular.map((s) => ({
        rings: s.rings.toNumber(),
        correctedTeiler: s.teiler.toNumber(),
        ringteiler: s.ringteiler.toNumber(),
      }))
      return duelOutcome(a, b, c.scoringMode, c.groupTiebreaker1, c.groupTiebreaker2) !== "TIE"
    })
  )
  add(
    "bestof:stechschuss",
    m.some((x) => x.series.some((s) => s.isTiebreak))
  )

  if (c.type === "LEAGUE" && m.length > 0) {
    if (c.leagueFormat === "BEST_OF_SINGLE") {
      const rows = await rw.getBestOfStandingsForCompetition(competitionId)
      add(
        "direkt:offen",
        rows.some((r) => r.directComparison?.kind === "open")
      )
      add(
        "direkt:ausgeglichen",
        rows.some((r) => r.directComparison?.kind === "even")
      )
    } else {
      const rows = await rw.getStandingsForCompetition(competitionId)
      const shared = (rank: number) => rows.filter((r) => r.rank === rank).length >= 2
      add("platz:geteilt-1-und-3", shared(1) && shared(3))
      add("liga:ringe-gegen-ringteiler", ringsAgainstRingteiler(rows, m, c.scoringMode))
    }
  }

  // Gemischt: eine fertige Paarung, die nach dem Teiler vom Ausdruck anders ausgeht als nach dem korrigierten
  const factor = new Map(
    enrolled.map((cp) => [cp.participantId, cp.discipline?.teilerFaktor.toNumber() ?? 1])
  )
  add(
    "liga:teiler-roh-anders",
    c.disciplineId === null &&
      m.some((x) => {
        if (x.status !== "COMPLETED" || x.awayParticipantId === null) return false
        const home = x.series.find((s) => s.participantId === x.homeParticipantId)
        const away = x.series.find((s) => s.participantId === x.awayParticipantId)
        if (!home || !away) return false
        const side = (s: typeof home, corrected: boolean) => ({
          rings: s.rings.toNumber(),
          teiler: s.teiler.toNumber() * (corrected ? factor.get(s.participantId)! : 1),
          ringteiler: s.ringteiler.toNumber(),
        })
        return (
          determineOutcome(side(home, false), side(away, false), c.scoringMode) !==
          determineOutcome(side(home, true), side(away, true), c.scoringMode)
        )
      })
  )

  // Liga: Playoffs
  const p = c.playoffMatches
  add("playoffs:keine", c.type === "LEAGUE" && p.length === 0)
  add(
    "playoffs:achtelfinale",
    p.some((x) => x.round === "EIGHTH_FINAL")
  )
  add(
    "playoffs:viertelfinale",
    !p.some((x) => x.round === "EIGHTH_FINAL") && p.some((x) => x.round === "QUARTER_FINAL")
  )
  add(
    "playoffs:nur-halbfinale",
    p.length > 0 &&
      !p.some((x) => x.round === "EIGHTH_FINAL" || x.round === "QUARTER_FINAL") &&
      p.some((x) => x.round === "SEMI_FINAL")
  )
  if (p.length > 0) {
    const latest = Math.max(...p.map((x) => ROUND_ORDER.indexOf(x.round)))
    const round = p.filter((x) => ROUND_ORDER.indexOf(x.round) === latest)
    const isFinal = ROUND_ORDER[latest] === "FINAL"
    add(
      "runde:mitten",
      !isFinal &&
        round.some((x) => x.status === "COMPLETED") &&
        round.some((x) => x.status !== "COMPLETED" && x.winsA + x.winsB > 0)
    )
    add("runde:fertig-nicht-weiter", !isFinal && round.every((x) => x.status === "COMPLETED"))
    const final = p.find((x) => x.round === "FINAL")
    if (final) {
      add("finale:offen", final.status !== "COMPLETED")
      if (final.status === "COMPLETED") {
        const sudden = final.duels.some((d) => d.isSuddenDeath && d.isCompleted)
        const decisive = final.duels.filter((d) => d.isCompleted && !d.isSuddenDeath).at(-1)
        const [a, b] = decisive?.results.map((r) => r.totalRings.toString()) ?? []
        add("finale:verlaengerung", sudden)
        add("finale:stichkriterium", !sudden && a !== undefined && a === b)
        add("finale:hauptwertung", !sudden && a !== undefined && a !== b)
        // gleiche Ringe, der Sieger des Finales hat den kleineren Ringteiler
        const winner =
          final.winsA > final.winsB
            ? final.participantAId
            : final.winsB > final.winsA
              ? final.participantBId
              : null
        const rt = (won: boolean) =>
          decisive?.results
            .find((r) => (r.participantId === winner) === won)
            ?.ringteiler?.toNumber()
        const [rtWinner, rtLoser] = [rt(true), rt(false)]
        add(
          "finale:stichkriterium-entscheidet",
          !sudden &&
            a !== undefined &&
            a === b &&
            rtWinner !== undefined &&
            rtLoser !== undefined &&
            rtWinner < rtLoser
        )
      }
    }
  }

  // Event und Saison
  if (c.type !== "LEAGUE" && enrolled.length > 0) {
    const scored =
      c.type === "EVENT"
        ? enrolled.filter((cp) => c.series.some((s) => s.competitionParticipantId === cp.id))
        : enrolled.filter((cp) => c.series.some((s) => s.participantId === cp.participantId))
    add("serien:keine", scored.length === 0)
    add("serien:teilweise", scored.length > 0 && scored.length < enrolled.length)
    add("serien:alle", scored.length === enrolled.length)
  }
  add(
    "startnummern",
    enrolled.some((cp) => cp.startNumber !== null)
  )
  add(
    "gaeste",
    enrolled.some((cp) => cp.isGuest)
  )
  add(
    "teams",
    enrolled.some((cp) => cp.eventTeamId !== null)
  )
  const keys = c.series.map((s) => `${s.rings.toString()}|${s.teiler.toString()}`)
  add("plaetze:geteilt", c.type === "EVENT" && new Set(keys).size < keys.length)
  if (c.targetValue !== null) {
    const target = c.targetValue.toNumber()
    add(
      "ziel:getroffen",
      c.series.some((s) =>
        c.targetValueType === "TEILER"
          ? s.teiler.toNumber() === target
          : s.rings.toNumber() === target
      )
    )
  }
  if (c.type === "SEASON" && c.minSeries !== null) {
    const counts = active.map(
      (cp) => c.series.filter((s) => s.participantId === cp.participantId).length
    )
    add(
      "saison:mindestserien-erreicht",
      counts.some((n) => n >= c.minSeries!)
    )
    add(
      "saison:mindestserien-verfehlt",
      counts.some((n) => n > 0 && n < c.minSeries!)
    )
    add(
      "saison:ohne-serie",
      counts.some((n) => n === 0)
    )
    add(
      "saison:ohne-mindestzahl-gewertet",
      active.some((cp, i) => cp.exemptFromMinSeries && counts[i] > 0 && counts[i] < c.minSeries!)
    )
    add(
      "saison:ohne-mindestzahl-ohne-serie",
      active.some((cp, i) => cp.exemptFromMinSeries && counts[i] === 0)
    )
  }

  return facts
}

export interface ScenarioCheck {
  scenario: Scenario
  missing: Fact[]
}

/** Prüft jedes Szenario gegen seine Erwartung; der Wettbewerb wird über den Namen gefunden. */
export async function verifyScenarios(
  rw: Ringwerk,
  scenarios: Scenario[]
): Promise<ScenarioCheck[]> {
  const checks: ScenarioCheck[] = []
  for (const scenario of scenarios) {
    const found = await rw.db.competition.findMany({
      where: { name: scenario.name },
      select: { id: true },
    })
    if (found.length !== 1) {
      throw new Error(`${scenario.name}: ${found.length} Wettbewerbe statt einem`)
    }
    const facts = await factsOf(rw, found[0].id)
    const expected = [...scenario.expect, ...(scenario.public ? [publicFact(scenario)] : [])]
    checks.push({ scenario, missing: expected.filter((f) => !facts.has(f)) })
  }
  return checks
}

function publicFact(scenario: Scenario): Fact {
  if (scenario.public === "passwort-qr") return "oeffentlich:qr"
  if (scenario.public === "passwort") return "oeffentlich:passwort"
  return "oeffentlich:offen"
}

/**
 * Zwei oder mehr stehen gleich in Punkten und in den Punkten aus ihren Duellen untereinander, und die meisten Ringe
 * ordnen sie anders als der beste Ringteiler.
 */
function ringsAgainstRingteiler(
  rows: Awaited<ReturnType<Ringwerk["getStandingsForCompetition"]>>,
  matchups: {
    status: string
    homeParticipantId: string
    awayParticipantId: string | null
    series: {
      participantId: string
      rings: { toNumber(): number }
      teiler: { toNumber(): number }
      ringteiler: { toNumber(): number }
    }[]
  }[],
  scoringMode: Parameters<typeof determineOutcome>[2]
): boolean {
  const active = rows.filter((r) => !r.withdrawn)
  for (const points of new Set(active.map((r) => r.points))) {
    const group = active.filter((r) => r.points === points)
    if (group.length < 2) continue
    const ids = new Set(group.map((r) => r.participantId))
    const direct = new Map<string, number>()
    for (const x of matchups) {
      if (x.status !== "COMPLETED" || x.awayParticipantId === null) continue
      if (!ids.has(x.homeParticipantId) || !ids.has(x.awayParticipantId)) continue
      const side = (id: string) => {
        const s = x.series.find((y) => y.participantId === id)!
        return {
          rings: s.rings.toNumber(),
          teiler: s.teiler.toNumber(),
          ringteiler: s.ringteiler.toNumber(),
        }
      }
      const outcome = determineOutcome(
        side(x.homeParticipantId),
        side(x.awayParticipantId),
        scoringMode
      )
      const home = outcome === "HOME_WIN" ? 2 : outcome === "DRAW" ? 1 : 0
      direct.set(x.homeParticipantId, (direct.get(x.homeParticipantId) ?? 0) + home)
      direct.set(x.awayParticipantId, (direct.get(x.awayParticipantId) ?? 0) + 2 - home)
    }
    for (const a of group) {
      for (const b of group) {
        if (a === b || (direct.get(a.participantId) ?? 0) !== (direct.get(b.participantId) ?? 0))
          continue
        if (a.bestRings === null || b.bestRings === null) continue
        if (a.bestRingteiler === null || b.bestRingteiler === null) continue
        if (a.bestRings > b.bestRings && a.bestRingteiler > b.bestRingteiler) return true
      }
    }
  }
  return false
}
