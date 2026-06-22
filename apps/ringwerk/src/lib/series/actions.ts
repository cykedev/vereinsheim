// Serien-Aktionen sind nach Wettbewerbstyp aufgeteilt (Event vs. Saison).
// Diese Datei bleibt der stabile öffentliche Einstiegspunkt für Aufrufer.

export { saveEventSeries, deleteEventSeries } from "./eventSeries"
export { saveSeasonSeries } from "./saveSeasonSeries"
export { updateSeasonSeries } from "./updateSeasonSeries"
export { deleteSeasonSeries } from "./deleteSeasonSeries"
