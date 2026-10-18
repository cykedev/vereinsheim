// Merkmale eines Wettbewerbs aus der Datenbank: was nachweislich darin steht, unabhängig davon, wie `build.ts` es
// erzeugt hat. Für Tabellenplätze und den direkten Vergleich zählt Ringwerks eigene Tabellen-Abfrage.

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
          series: { select: { duelNumber: true, isTiebreak: true, participantId: true } },
        },
      },
      playoffMatches: {
        select: {
          round: true,
          status: true,
          winsA: true,
          winsB: true,
          duels: {
            select: {
              isSuddenDeath: true,
              isCompleted: true,
              results: { select: { totalRings: true } },
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
      new Set(enrolled.map((cp) => cp.discipline?.teilerFaktor.toString())).size >= 2
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
      return open(x) && regular.length === 2 && regular.every((s) => s.duelNumber === 1)
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
    }
  }

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
