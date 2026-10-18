// Welche Phasen der Matrix des Prüfbestands enthält eine Datenbank? Je Wettbewerb seine Merkmale (Art, Format, Phase, Wertung,
// Teams, Veröffentlichung, Freilos, Kampflos, Rückzug), gelesen in einer Transaktion, die nur lesen darf. Der Bericht
// nennt nur Zahlen je Merkmal, keine Namen: Er entsteht auch an der Kopie der echten Daten (ADR-029).

import { Client } from "pg"

export interface CompetitionFacts {
  type: "LEAGUE" | "EVENT" | "SEASON"
  status: string
  leagueFormat: string | null
  groupBestOf: number | null
  scoringMode: string
  targetValueType: string | null
  teamSize: number | null
  teamScoring: string | null
  seasonSortMode: string | null
  isPublic: boolean
  hasPassword: boolean
  participants: number
  withdrawn: number
  matchups: number
  completed: number
  byes: number
  walkovers: number
  secondLeg: number
  secondLegCompleted: number
  /** Playoff-Runde → [Matches, davon fertig] */
  playoffs: Record<string, [number, number]>
  finalSuddenDeath: boolean
  series: number
  /** Einschreibungen mit mindestens einer Serie */
  withSeries: number
}

const ROUNDS: [string, string][] = [
  ["EIGHTH_FINAL", "Achtelfinale"],
  ["QUARTER_FINAL", "Viertelfinale"],
  ["SEMI_FINAL", "nur Halbfinale"],
]

/** Merkmale eines Wettbewerbs in den Begriffen der Matrix */
export function featuresOf(c: CompetitionFacts): string[] {
  const f: string[] = []
  if (c.isPublic) f.push(c.hasPassword ? "öffentlich mit Passwort" : "öffentlich ohne Passwort")
  if (c.withdrawn > 0) f.push("Rückzug")
  if (c.status === "ARCHIVED") f.push("archiviert")
  if (c.type === "LEAGUE") {
    const format =
      c.leagueFormat === "BEST_OF_SINGLE" ? `Liga Best-of-${c.groupBestOf ?? "?"}` : "Liga Hin/Rück"
    f.push(format)
    if (c.byes > 0) f.push("Liga: Freilos")
    if (c.walkovers > 0) f.push("Liga: Kampflos")
    f.push(`${format} · ${leaguePhase(c)}`)
    return f
  }
  if (c.type === "EVENT") {
    const scoring = c.targetValueType ? `${c.scoringMode} (${c.targetValueType})` : c.scoringMode
    f.push(`Event · ${scoring}`)
    if ((c.teamSize ?? 0) >= 2) f.push(`Event · Team ${c.teamScoring ?? "?"} zu ${c.teamSize}`)
    f.push(
      `Event · ${c.series === 0 ? (c.participants === 0 ? "leer" : "Starterliste") : c.withSeries < c.participants ? "teilweise gewertet" : "fertig"}`
    )
    return f
  }
  f.push(`Saison · ${c.seasonSortMode ?? c.scoringMode}`)
  f.push(
    `Saison · ${c.series === 0 ? "ohne Serie" : c.withSeries < c.participants ? "gemischt" : "jede Einschreibung mit Serie"}`
  )
  return f
}

function leaguePhase(c: CompetitionFacts): string {
  const final = c.playoffs.FINAL
  const ended = c.status === "COMPLETED" || c.status === "ARCHIVED"
  if (ended)
    return Object.keys(c.playoffs).length > 0 ? "L7 Ende mit Playoffs" : "L7 Ende ohne Playoffs"
  if (final) {
    if (final[1] < final[0]) return "L6 Finale läuft"
    return c.finalSuddenDeath ? "L6 Finale in der Verlängerung" : "L6 Finale entschieden"
  }
  // Größe des Brackets aus der ersten Runde, Stand aus der jüngsten
  const present = ROUNDS.filter(([round]) => c.playoffs[round])
  if (present.length > 0) {
    const [first, latest] = [present[0], present.at(-1)!]
    const [n, done] = c.playoffs[latest[0]]
    const where =
      first === latest ? first[1] : `${first[1]}, jetzt ${latest[1].replace("nur ", "")}`
    return done < n ? `L5 ${where} mitten` : `L5 ${where} fertig, nicht weitergeschaltet`
  }
  const played = c.matchups - c.byes
  if (c.matchups === 0)
    return c.participants === 0 ? "L0 ohne Teilnehmer" : "L0 Teilnehmer ohne Spielplan"
  if (c.completed + c.walkovers === 0) return "L1 Spielplan, kein Ergebnis"
  if (c.completed + c.walkovers >= played) return "L4 Gruppenphase fertig"
  if (c.secondLegCompleted > 0) return "L3 Rückrunde läuft"
  return "L2 Hinrunde läuft"
}

/** Merkmal → Zahl der Wettbewerbe, gelesen in einer Transaktion, die nur lesen darf */
export async function phaseCounts(url: string): Promise<Map<string, number>> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await client.query("BEGIN TRANSACTION READ ONLY")
    const { rows } = await client.query<CompetitionFacts & { id: string }>(`
      SELECT c.id, c.type, c.status, c."leagueFormat", c."groupBestOf", c."scoringMode", c."targetValueType",
        c."teamSize", c."teamScoring", c."seasonSortMode", c."isPublic",
        (c."publicPasswordHash" IS NOT NULL) AS "hasPassword",
        (SELECT count(*)::int FROM "CompetitionParticipant" cp WHERE cp."competitionId" = c.id AND cp.status = 'ACTIVE') AS participants,
        (SELECT count(*)::int FROM "CompetitionParticipant" cp WHERE cp."competitionId" = c.id AND cp.status = 'WITHDRAWN') AS withdrawn,
        (SELECT count(*)::int FROM "Matchup" m WHERE m."competitionId" = c.id) AS matchups,
        (SELECT count(*)::int FROM "Matchup" m WHERE m."competitionId" = c.id AND m.status = 'COMPLETED') AS completed,
        (SELECT count(*)::int FROM "Matchup" m WHERE m."competitionId" = c.id AND m.status = 'BYE') AS byes,
        (SELECT count(*)::int FROM "Matchup" m WHERE m."competitionId" = c.id AND m.status = 'WALKOVER') AS walkovers,
        (SELECT count(*)::int FROM "Matchup" m WHERE m."competitionId" = c.id AND m.round = 'SECOND_LEG') AS "secondLeg",
        (SELECT count(*)::int FROM "Matchup" m WHERE m."competitionId" = c.id AND m.round = 'SECOND_LEG' AND m.status = 'COMPLETED') AS "secondLegCompleted",
        COALESCE((SELECT jsonb_object_agg(round, jsonb_build_array(n, done)) FROM (
          SELECT pm.round, count(*)::int AS n, count(*) FILTER (WHERE pm.status = 'COMPLETED')::int AS done
            FROM "PlayoffMatch" pm WHERE pm."competitionId" = c.id GROUP BY pm.round) r), '{}'::jsonb) AS playoffs,
        EXISTS (SELECT 1 FROM "PlayoffDuel" d JOIN "PlayoffMatch" pm ON pm.id = d."playoffMatchId"
          WHERE pm."competitionId" = c.id AND pm.round = 'FINAL' AND d."isSuddenDeath") AS "finalSuddenDeath",
        (SELECT count(*)::int FROM "Series" s WHERE s."competitionId" = c.id) AS series,
        (SELECT count(DISTINCT s."participantId")::int FROM "Series" s WHERE s."competitionId" = c.id) AS "withSeries"
      FROM "Competition" c`)
    await client.query("ROLLBACK")
    const counts = new Map<string, number>()
    for (const row of rows)
      for (const feature of featuresOf(row)) counts.set(feature, (counts.get(feature) ?? 0) + 1)
    return counts
  } finally {
    await client.end()
  }
}

/** Bericht: welche Merkmale beide Datenbanken haben, welche nur der Prüfbestand und welche er nicht abdeckt */
export function phaseReport(real: Map<string, number>, pruef: Map<string, number>): string {
  const all = [...new Set([...real.keys(), ...pruef.keys()])].sort((a, b) =>
    a.localeCompare(b, "de")
  )
  const row = (k: string) => `| ${k} | ${real.get(k) ?? 0} | ${pruef.get(k) ?? 0} |`
  const head = ["| Merkmal | echte Daten | Prüfbestand |", "| --- | ---: | ---: |"]
  const onlyReal = all.filter((k) => real.has(k) && !pruef.has(k))
  return [
    "# Phasen in den echten Daten",
    "",
    "Zahl der Wettbewerbe je Merkmal. Gezählt wird nur, keine Namen.",
    "",
    "## In beiden",
    "",
    ...head,
    ...all.filter((k) => real.has(k) && pruef.has(k)).map(row),
    "",
    "## Nur im Prüfbestand",
    "",
    ...head,
    ...all.filter((k) => !real.has(k)).map(row),
    "",
    "## Nur in den echten Daten (deckt der Prüfbestand nicht ab)",
    "",
    ...(onlyReal.length > 0 ? [...head, ...onlyReal.map(row)] : ["keine"]),
    "",
  ].join("\n")
}
