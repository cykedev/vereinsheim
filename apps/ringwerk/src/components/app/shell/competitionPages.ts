/** die Unterseiten eines Wettbewerbs */
export type CompetitionPage =
  "schedule" | "ranking" | "standings" | "playoffs" | "series" | "participants" | "audit-log"

const LABEL: Readonly<Record<CompetitionPage, string>> = {
  schedule: "Spielplan & Tabelle",
  ranking: "Rangliste",
  standings: "Rangliste",
  playoffs: "Playoffs",
  series: "Serien erfassen",
  participants: "Teilnehmer",
  "audit-log": "Protokoll",
}

/** Reihenfolge der Reiter: Ergebnis zuerst, dann Playoffs, Erfassen, Teilnehmer und Protokoll */
const ORDER: readonly CompetitionPage[] = [
  "schedule",
  "ranking",
  "standings",
  "playoffs",
  "series",
  "participants",
  "audit-log",
]

export const competitionPageHref = (id: string, page: CompetitionPage) =>
  `/competitions/${id}/${page}`

/**
 * Die Reiter einer Seite: die gezeigte und die Seiten, zu denen sie führt, in fester Reihenfolge und ohne doppelte.
 * Welche Seiten das sind, entscheidet die Seite (Art des Wettbewerbs, Rolle).
 */
export function competitionTabs(
  id: string,
  current: CompetitionPage,
  links: readonly CompetitionPage[]
): { href: string; label: string }[] {
  const pages = new Set([current, ...links])
  return ORDER.filter((page) => pages.has(page)).map((page) => ({
    href: competitionPageHref(id, page),
    label: LABEL[page],
  }))
}

/**
 * Wohin der Einstieg in einen Wettbewerb führt: Event zur Rangliste, Saison zur Rangliste der Saison, Liga zu
 * Spielplan und Tabelle, sobald die Playoffs laufen aber zu den Playoffs. Dort steht dann die Antwort, wie es steht.
 */
export function entryPage(
  type: "LEAGUE" | "EVENT" | "SEASON",
  playoffsStarted: boolean
): CompetitionPage {
  if (type === "EVENT") return "ranking"
  if (type === "SEASON") return "standings"
  return playoffsStarted ? "playoffs" : "schedule"
}
