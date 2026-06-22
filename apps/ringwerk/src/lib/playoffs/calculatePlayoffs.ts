// Playoff-Berechnungen sind nach Regelwerk, Finale-Outcome und Bracket-Seeding
// aufgeteilt. Diese Datei bleibt der stabile öffentliche Einstiegspunkt.

export type { PlayoffDuelOutcome, PlayoffRuleset } from "./playoffRuleset"
export { getNextRound, requiredWinsFromBestOf, isPlayoffMatchComplete } from "./playoffRuleset"
export {
  determineFinaleRoundWinner,
  finaleNeedsTeiler,
  determinePlayoffDuelWinner,
} from "./finaleOutcome"
export { createFirstRoundMatchups, createNextRoundMatchups } from "./bracketSeeding"
