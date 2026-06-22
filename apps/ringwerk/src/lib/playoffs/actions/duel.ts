// Playoff-Duell-Aktionen sind in saveDuel/deleteDuel aufgeteilt; gemeinsame
// Hilfslogik liegt in duelHelpers. Diese Datei bleibt der stabile Einstiegspunkt.

export { savePlayoffDuelResult } from "./saveDuel"
export { deleteLastPlayoffDuel } from "./deleteDuel"
