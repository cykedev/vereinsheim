// Liga-Szenarien: Wettbewerb anlegen, einschreiben, Spielplan generieren, Ergebnisse eintragen, Playoffs starten,
// Duelle bis zum Finale, Runden weiterschalten, abschließen. Alles über Ringwerks Actions, in der Reihenfolge, in der
// die Oberfläche sie aufruft. Einzige Ausnahme ist der Kampflos-Sieg: Ihn setzt keine Action, `build.ts` schreibt den
// Status der Paarung direkt (siehe `writeWalkover`).

import type { MatchStatus, Round, ScoringMode, ScoringType } from "@/generated/prisma/client"

import { advance } from "./clock"
import { act, addDays, dateField, formData, type Context, type PoolParticipant } from "./context"
import { createRandom, type Random } from "./random"
import { forcedPair, seriesValue, type SeriesValue, type Winner } from "./results"
import type { LeagueScenario } from "./scenarios"

interface Player extends PoolParticipant {
  strength: number
}

interface LeagueMatchup {
  id: string
  round: Round
  roundIndex: number
  status: MatchStatus
  homeParticipantId: string
  awayParticipantId: string | null
}

interface League {
  ctx: Context
  s: LeagueScenario
  id: string
  random: Random
  players: Player[]
  scoringMode: ScoringMode
  scoringType: ScoringType
  bestOf: number | null
}

const SCORING_MODE: Record<LeagueScenario["format"], ScoringMode> = {
  DRR: "RINGTEILER",
  BO3: "RINGTEILER",
  BO5: "RINGS",
}

export async function buildLeague(ctx: Context, s: LeagueScenario, start: Date): Promise<void> {
  const random = createRandom(s.code)
  const disciplineKey = s.discipline ?? (s.format === "BO3" ? "Luftpistole" : "Luftgewehr")
  const disciplineId = ctx.disciplines[disciplineKey]
  const discipline = await ctx.rw.db.discipline.findUniqueOrThrow({
    where: { id: disciplineId },
    select: { scoringType: true },
  })
  const isBestOf = s.format !== "DRR"
  const bracket = s.bracket
  const slug = s.public ? s.code.toLowerCase() : undefined

  const created = await act(ctx, "Liga anlegen", () =>
    ctx.rw.createCompetition(
      null,
      formData({
        name: s.name,
        type: "LEAGUE",
        scoringMode: SCORING_MODE[s.format],
        shotsPerSeries: 10,
        disciplineId,
        leagueFormat: isBestOf ? "BEST_OF_SINGLE" : "DOUBLE_ROUND_ROBIN",
        groupBestOf: isBestOf ? (s.format === "BO3" ? 3 : 5) : undefined,
        groupPlayAllDuels: isBestOf,
        groupHasSuddenDeath: isBestOf,
        groupTiebreaker1: isBestOf ? "none" : undefined,
        groupTiebreaker2: isBestOf ? "none" : undefined,
        // Die Stichtage blendet das Formular im Best-of-Format aus.
        hinrundeDeadline: isBestOf ? undefined : dateField(addDays(start, 45)),
        rueckrundeDeadline: isBestOf ? undefined : dateField(addDays(start, 90)),
        playoffBestOf: 5,
        playoffHasViertelfinale: bracket === undefined || bracket === "VF" || bracket === "AF",
        playoffHasAchtelfinale: bracket === "AF",
        finalePrimary: "RINGS",
        finaleTiebreaker1: s.phase === "L6-stichkriterium" ? "TEILER" : "none",
        finaleTiebreaker2: "none",
        finaleHasSuddenDeath: true,
        isPublic: s.public !== undefined,
        publicSlug: slug,
        publicPassword: s.public?.startsWith("passwort") ? ctx.publicPassword : undefined,
        publicAccessFields: s.public ? "1" : undefined,
        publicQrBypass: s.public === "passwort-qr",
      })
    )
  )
  const id = created!.id
  if (s.phase === "L0-leer") return

  const source = s.longNames ? ctx.longNamePool : random.shuffle(ctx.pool)
  const players: Player[] = source
    .slice(0, s.size)
    .map((p) => ({ ...p, strength: Math.round(random.next() * 100) / 100 }))
  for (const player of players) {
    await act(ctx, "einschreiben", () =>
      ctx.rw.enrollParticipant(id, null, formData({ participantId: player.id }))
    )
  }
  if (s.phase === "L0-teilnehmer") return

  await act(ctx, "Spielplan generieren", () => ctx.rw.generateCompetitionSchedule(id))
  if (s.phase === "L1") return

  const league: League = {
    ctx,
    s,
    id,
    random,
    players,
    scoringMode: SCORING_MODE[s.format],
    scoringType: discipline.scoringType,
    bestOf: isBestOf ? (s.format === "BO3" ? 3 : 5) : null,
  }
  await playGroupPhase(league)
  if (s.phase === "L2" || s.phase === "L3" || s.phase === "L4" || s.phase === "gleichstand") return
  if (s.phase === "L7-ohne-playoffs") {
    await act(ctx, "abschließen", () => ctx.rw.setCompetitionStatus(id, "COMPLETED"))
    return
  }

  await act(ctx, "Playoffs starten", () => ctx.rw.startPlayoffs(id))
  await playPlayoffs(league)
}

// ─── Gruppenphase ──────────────────────────────────────────────────────────────────────────────

async function loadMatchups(league: League): Promise<LeagueMatchup[]> {
  const rows = await league.ctx.rw.db.matchup.findMany({
    where: { competitionId: league.id },
    select: {
      id: true,
      round: true,
      roundIndex: true,
      status: true,
      homeParticipantId: true,
      awayParticipantId: true,
    },
  })
  // Reihenfolge ohne die zufälligen IDs: Runde, Spieltag, dann Einschreibe-Reihenfolge der Teilnehmer.
  const order = new Map(league.players.map((p, i) => [p.id, i]))
  const rank = (id: string | null) => (id === null ? -1 : (order.get(id) ?? 999))
  return rows.sort(
    (a, b) =>
      a.round.localeCompare(b.round) ||
      a.roundIndex - b.roundIndex ||
      rank(a.homeParticipantId) - rank(b.homeParticipantId) ||
      rank(a.awayParticipantId) - rank(b.awayParticipantId)
  )
}

function strengthOf(league: League, participantId: string): number {
  return league.players.find((p) => p.id === participantId)?.strength ?? 0.5
}

const isPlayable = (m: LeagueMatchup) => m.awayParticipantId !== null && m.status === "PENDING"

async function playGroupPhase(league: League): Promise<void> {
  const { s } = league
  const matchups = await loadMatchups(league)
  const playable = matchups.filter(isPlayable)

  if (s.phase === "gleichstand") {
    // Zwei Paare schießen in jeder Paarung dieselbe Serie: Beide Paare spielen gegeneinander unentschieden und
    // gewinnen gegen das andere Paar. Platz 1 und Platz 3 sind dadurch geteilt.
    const strong: SeriesValue = { rings: 95, teiler: 20.5 }
    const weak: SeriesValue = { rings: 90, teiler: 60 }
    const valueOf = (id: string) =>
      league.players.findIndex((p) => p.id === id) < 2 ? strong : weak
    for (const m of playable) {
      await saveDrr(league, m, valueOf(m.homeParticipantId), valueOf(m.awayParticipantId!))
    }
    return
  }

  if (s.phase === "L4" && league.bestOf !== null) {
    await playThreeWayCycle(league, playable)
    return
  }

  if (s.phase === "L2") {
    if (league.bestOf === null) {
      const firstLeg = playable.filter((m) => m.round === "FIRST_LEG")
      for (const m of firstLeg.filter((m) => m.roundIndex <= 3)) await playRandom(league, m)
      const next = firstLeg.filter((m) => m.roundIndex === 4)
      await writeWalkover(league, next[0])
      await playRandom(league, next[1])
      await withdraw(league, weakestWithOpenMatchups(league, await loadMatchups(league)))
      return
    }
    // Best-of, sieben Teilnehmer: Spieltag 1 voll, jede Begegnung mit einem Satz Unterschied. Die drei Sieger stehen
    // danach gleich und haben noch nicht gegeneinander geschossen, ebenso die drei Verlierer. Spieltag 2: eine Paarung
    // 1:0 offen, eine über den Stechschuss, eine kampflos. Das verändert höchstens zwei der sechs, also bleiben in
    // einer der beiden Gruppen zwei Gleichstehende ohne Direktvergleich: „offen“. Zurückgezogen wird, wer an
    // Spieltag 1 Freilos hatte; sein Rückzug nimmt keinem der sechs ein gewertetes Ergebnis aus Spieltag 1.
    for (const m of playable.filter((m) => m.roundIndex === 1)) {
      await playBestOf(league, m, closePlan(league, m, strongerWins(league, m)))
    }
    const next = playable.filter((m) => m.roundIndex === 2)
    await playBestOf(league, next[0], ["A"])
    const level: Winner[] = league.bestOf === 3 ? ["A", "B", "TIE"] : ["A", "B", "A", "B", "TIE"]
    await playBestOf(league, next[1], level)
    await writeWalkover(league, next[2])
    const bye = matchups.find((m) => m.roundIndex === 1 && m.status === "BYE")!
    await withdraw(league, bye.homeParticipantId)
    return
  }

  if (s.phase === "L3") {
    for (const m of playable.filter((m) => m.round === "FIRST_LEG")) await playRandom(league, m)
    const secondLeg = playable.filter((m) => m.round === "SECOND_LEG")
    for (const m of secondLeg.filter((m) => m.roundIndex <= 2)) await playRandom(league, m)
    await playRandom(league, secondLeg.find((m) => m.roundIndex === 3)!)
    return
  }

  for (const m of playable) await playRandom(league, m)
}

async function playRandom(league: League, m: LeagueMatchup): Promise<void> {
  if (league.bestOf !== null) {
    await playBestOf(league, m)
    return
  }
  const home = seriesValue(
    league.random,
    league.scoringType,
    strengthOf(league, m.homeParticipantId)
  )
  const away = seriesValue(
    league.random,
    league.scoringType,
    strengthOf(league, m.awayParticipantId!)
  )
  await saveDrr(league, m, home, away)
}

async function saveDrr(
  league: League,
  m: LeagueMatchup,
  home: SeriesValue,
  away: SeriesValue
): Promise<void> {
  await act(league.ctx, "Ergebnis eintragen", () =>
    league.ctx.rw.saveMatchResult(m.id, { homeResult: home, awayResult: away })
  )
}

/**
 * Trägt Duelle einer Best-of-Paarung ein. Mit `plan` gewinnt je Duell die vorgegebene Seite (A = Heim); der Plan darf
 * kürzer sein als N (Paarung bleibt offen). Ohne Plan entscheidet die Stärke. Steht es nach N Duellen gleich, folgt der
 * Stechschuss.
 */
async function playBestOf(league: League, m: LeagueMatchup, plan?: Winner[]): Promise<void> {
  const n = league.bestOf!
  const duels = plan ? plan.length : n
  for (let duel = 1; duel <= duels; duel++) {
    const [home, away] = plan
      ? forcedPair(league.random, league.scoringType, league.scoringMode, plan[duel - 1])
      : [
          seriesValue(league.random, league.scoringType, strengthOf(league, m.homeParticipantId)),
          seriesValue(league.random, league.scoringType, strengthOf(league, m.awayParticipantId!)),
        ]
    await act(league.ctx, `Best-of-Duell ${duel}`, () =>
      league.ctx.rw.saveBestOfDuel({
        matchupId: m.id,
        duelNumber: duel,
        homeResult: home,
        awayResult: away,
      })
    )
  }
  if (duels < n) return
  for (let round = 0; round < 10; round++) {
    const { status } = await league.ctx.rw.db.matchup.findUniqueOrThrow({
      where: { id: m.id },
      select: { status: true },
    })
    if (status === "COMPLETED") return
    const homeShot = Math.round((9 + league.random.next() * 1.9) * 10) / 10
    let awayShot = Math.round((9 + league.random.next() * 1.9) * 10) / 10
    if (awayShot === homeShot) awayShot = homeShot === 10.9 ? 10.8 : homeShot + 0.1
    await act(league.ctx, "Stechschuss", () =>
      league.ctx.rw.saveStechschuss({ matchupId: m.id, homeShot, awayShot })
    )
  }
  throw new Error(`${league.ctx.scenario}: Best-of-Paarung nicht entschieden`)
}

/** Duell-Plan mit einem Satz Unterschied (2:1 bzw. 3:2) für die Heim- oder die Gastseite. */
function closePlan(league: League, m: LeagueMatchup, homeWins: boolean): Winner[] {
  const pattern = league.bestOf === 3 ? ["W", "L", "W"] : ["W", "L", "W", "L", "W"]
  return pattern.map((r): Winner => ((r === "W") === homeWins ? "A" : "B"))
}

function strongerWins(league: League, m: LeagueMatchup): boolean {
  return strengthOf(league, m.homeParticipantId) >= strengthOf(league, m.awayParticipantId!)
}

/**
 * Best-of-Gruppe mit vier Teilnehmern: 0 schlägt 1, 1 schlägt 2, 2 schlägt 0, jeweils mit einem Satz Unterschied, und
 * alle drei schlagen 3 genauso. Die drei stehen gleich in Siegen, Sätzen und Satzdifferenz, und der direkte Vergleich
 * ist ein Kreis: „ausgeglichen“.
 */
async function playThreeWayCycle(league: League, playable: LeagueMatchup[]): Promise<void> {
  const [p0, p1, p2, p3] = league.players.map((p) => p.id)
  const winnerOf = (a: string, b: string): string => {
    const pair = new Set([a, b])
    if (pair.has(p3)) return a === p3 ? b : a
    if (pair.has(p0) && pair.has(p1)) return p0
    if (pair.has(p1) && pair.has(p2)) return p1
    return p2
  }
  for (const m of playable) {
    const homeWins = winnerOf(m.homeParticipantId, m.awayParticipantId!) === m.homeParticipantId
    await playBestOf(league, m, closePlan(league, m, homeWins))
  }
}

/**
 * Kampflos-Sieg: Die Oberfläche zeigt den Status „Kampflos“ in Spielplan und PDF, aber keine Action setzt ihn. Der
 * Prüfbestand schreibt deshalb nur den Status dieser einen Paarung direkt; Serien entstehen dabei keine.
 */
async function writeWalkover(league: League, m: LeagueMatchup): Promise<void> {
  advance()
  await league.ctx.rw.db.matchup.update({ where: { id: m.id }, data: { status: "WALKOVER" } })
}

/** Der schwächste Teilnehmer, der noch offene Paarungen hat. */
function weakestWithOpenMatchups(league: League, matchups: LeagueMatchup[]): string {
  const open = (id: string) =>
    matchups.some(
      (m) => isPlayable(m) && (m.homeParticipantId === id || m.awayParticipantId === id)
    )
  return [...league.players]
    .filter((p) => open(p.id))
    .sort((a, b) => a.strength - b.strength || a.lastName.localeCompare(b.lastName, "de"))[0].id
}

async function withdraw(league: League, participantId: string): Promise<void> {
  const enrollment = await league.ctx.rw.db.competitionParticipant.findFirstOrThrow({
    where: { competitionId: league.id, participantId },
    select: { id: true },
  })
  await act(league.ctx, "zurückziehen", () =>
    league.ctx.rw.withdrawParticipant(
      enrollment.id,
      null,
      formData({ reason: "Umzug, kann die Saison nicht beenden" })
    )
  )
}

// ─── Playoffs ──────────────────────────────────────────────────────────────────────────────────

interface PlayoffState {
  id: string
  round: string
  status: MatchStatus
  winsA: number
  winsB: number
  participantAId: string
  participantBId: string
  duels: { id: string; isCompleted: boolean }[]
}

async function loadPlayoffMatches(league: League): Promise<PlayoffState[]> {
  const rows = await league.ctx.rw.db.playoffMatch.findMany({
    where: { competitionId: league.id },
    select: {
      id: true,
      round: true,
      status: true,
      winsA: true,
      winsB: true,
      participantAId: true,
      participantBId: true,
      duels: { select: { id: true, isCompleted: true, duelNumber: true } },
    },
  })
  const order = new Map(league.players.map((p, i) => [p.id, i]))
  for (const row of rows) row.duels.sort((a, b) => a.duelNumber - b.duelNumber)
  return rows.sort(
    (a, b) =>
      (order.get(a.participantAId) ?? 0) - (order.get(b.participantAId) ?? 0) ||
      (order.get(a.participantBId) ?? 0) - (order.get(b.participantBId) ?? 0)
  )
}

const ROUND_ORDER = ["EIGHTH_FINAL", "QUARTER_FINAL", "SEMI_FINAL", "FINAL"]

function currentRound(matches: PlayoffState[]): PlayoffState[] {
  const latest = Math.max(...matches.map((m) => ROUND_ORDER.indexOf(m.round)))
  return matches.filter((m) => ROUND_ORDER.indexOf(m.round) === latest)
}

/**
 * Spielt Duelle eines Playoff-Matches, bis es entschieden ist oder `stop` greift. Ein Duell legt die Oberfläche mit
 * „Duell hinzufügen“ an; nach einem Unentschieden legt die Action das nächste selbst an.
 */
async function playPlayoffMatch(
  league: League,
  matchId: string,
  stop: (m: PlayoffState) => boolean = () => false,
  plan: Winner[] = []
): Promise<void> {
  for (let step = 0; step < 20; step++) {
    const m = (await loadPlayoffMatches(league)).find((x) => x.id === matchId)!
    if (m.status === "COMPLETED" || stop(m)) return
    let duelId = m.duels.find((d) => !d.isCompleted)?.id
    if (!duelId) {
      const added = await act(league.ctx, "Duell hinzufügen", () =>
        league.ctx.rw.addPlayoffDuel(matchId)
      )
      duelId = added!.duelId
    }
    const forced = plan[step]
    const [a, b] = forced
      ? forcedPair(league.random, league.scoringType, "RINGTEILER", forced)
      : [
          seriesValue(league.random, league.scoringType, strengthOf(league, m.participantAId)),
          seriesValue(league.random, league.scoringType, strengthOf(league, m.participantBId)),
        ]
    await act(league.ctx, "Playoff-Duell eintragen", () =>
      league.ctx.rw.savePlayoffDuelResult({
        duelId: duelId!,
        totalRingsA: a.rings,
        teilerA: a.teiler,
        totalRingsB: b.rings,
        teilerB: b.teiler,
      })
    )
  }
  throw new Error(`${league.ctx.scenario}: Playoff-Match nicht entschieden`)
}

async function playRound(league: League): Promise<void> {
  for (const m of currentRound(await loadPlayoffMatches(league))) {
    await playPlayoffMatch(league, m.id)
  }
}

async function playPlayoffs(league: League): Promise<void> {
  const { ctx, s, id } = league
  if (s.phase === "L5-mitten") {
    // Alle Matches der ersten Runde entschieden bis auf das letzte; dort steht es 1:1.
    const round = currentRound(await loadPlayoffMatches(league))
    for (const m of round.slice(0, -1)) await playPlayoffMatch(league, m.id)
    await playPlayoffMatch(
      league,
      round[round.length - 1].id,
      (m) => m.winsA >= 1 && m.winsB >= 1,
      ["A", "B"]
    )
    return
  }
  if (s.phase === "L5-fertig") {
    await playRound(league)
    return
  }

  // Bis zum Finale: Runde ausspielen, weiterschalten.
  for (let i = 0; i < 4; i++) {
    const round = currentRound(await loadPlayoffMatches(league))
    if (round[0].round === "FINAL") break
    await playRound(league)
    await act(ctx, "Runde weiterschalten", () => ctx.rw.advanceRound(id))
  }
  const final = currentRound(await loadPlayoffMatches(league))[0]
  if (s.phase === "L6-offen") return

  const added = await act(ctx, "Finale: Duell hinzufügen", () => ctx.rw.addPlayoffDuel(final.id))
  const duelId = added!.duelId
  if (s.phase === "L6-stichkriterium") {
    // Gleiche Ringe, das Stichkriterium Teiler entscheidet.
    await act(ctx, "Finale eintragen", () =>
      ctx.rw.savePlayoffDuelResult({
        duelId,
        totalRingsA: 96,
        teilerA: 12.3,
        totalRingsB: 96,
        teilerB: 45.6,
      })
    )
    return
  }
  if (s.phase === "L6-verlaengerung") {
    // Gleichstand ohne Stichkriterium: Die Action legt ein Duell der Verlängerung an, das dann entscheidet.
    await act(ctx, "Finale eintragen", () =>
      ctx.rw.savePlayoffDuelResult({ duelId, totalRingsA: 95, totalRingsB: 95 })
    )
    const extra = currentRound(await loadPlayoffMatches(league))[0].duels.find(
      (d) => !d.isCompleted
    )!
    await act(ctx, "Verlängerung eintragen", () =>
      ctx.rw.savePlayoffDuelResult({ duelId: extra.id, totalRingsA: 9, totalRingsB: 10 })
    )
    return
  }

  await act(ctx, "Finale eintragen", () =>
    ctx.rw.savePlayoffDuelResult({ duelId, totalRingsA: 97, totalRingsB: 94 })
  )
  if (s.phase === "L6-hauptwertung") return

  await act(ctx, "abschließen", () => ctx.rw.setCompetitionStatus(id, "COMPLETED"))
  if (s.phase === "L7-archiviert") {
    await act(ctx, "archivieren", () => ctx.rw.setCompetitionStatus(id, "ARCHIVED"))
  }
}
