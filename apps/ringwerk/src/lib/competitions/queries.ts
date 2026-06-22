// Wettbewerbs-Abfragen sind nach Listen- und Serien-Abfragen aufgeteilt.
// Diese Datei bleibt der stabile öffentliche Einstiegspunkt für Aufrufer.

export { getCompetitions, getCompetitionsForManagement, getCompetitionById } from "./listQueries"
export { getEventWithSeries, getSeasonWithSeries } from "./seriesQueries"
