// Welche Katalog-IDs (vault/spiegel/spiegel-statistics.md) hinter jeder Auswertung stehen. Die Hilfe
// (`@vereinsheim/shot-help`) erzwingt damit für jede ID eine Erklärung; ein Test hier hält die Liste
// vollständig: Jede exportierte Funktion aus `./analysis` steht darin.

export const ANALYSIS_CATALOG: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // Ergebnis
  ringDistribution: ["V1"],
  decimalHistogram: ["V2"],
  shotExtremes: ["E8"],
  seriesConsistency: ["E10"],
  shareAtLeast: ["E4", "E11"],
  // Präzision
  sigmaEstimate: ["P5"],
  groupShape: ["P8"],
  ringWidths: ["P9"],
  outliers: ["V6"],
  outlierLoss: ["V7"],
  // Lage
  mpiConfidence: ["L1", "L3"],
  ringLossSplit: ["E9", "L4"],
  directionClock: ["L6"],
  drift: ["L8"],
  // Zeit
  tempoSpread: ["Z2"],
  pauseRecovery: ["Z4"],
  rhythmProfile: ["Z5"],
  // Verlauf
  seriesCurve: ["I1"],
  fatigue: ["I2"],
  cardTrend: ["I3"],
  movingAverage: ["I4"],
  seriesSpread: ["I5"],
  mpiPath: ["I6"],
  longestRun: ["I10"],
  // Datenlage (keine Auswertung der Probe S1–S4: eine Scheibe ist wie am Ausdruck)
  dataCoverage: ["Q1"],
  // Über viele Scheiben
  cardValues: ["T1"],
  periodTrend: ["T1", "T2"],
  periodBuckets: ["T5"],
  // je Woche (T6) oder je Abend für den Kalender (T7)
  trainingVolume: ["T6", "T7"],
  comparePeriods: ["C3", "T3"],
  compareSamples: ["C3", "T3"],
  compareCenters: ["C3"],
  againstOwnAverage: ["C4"],
  recordEligible: ["R1"],
  periodRecords: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R10", "R11"],
  cardRecordCandidates: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R10", "R11"],
  combineRecords: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R10", "R11"],
  // Trefferbild über viele Scheiben
  periodShape: ["L9"],
  periodPattern: ["L9"],
  positionPoints: ["L10"],
  positionOverTime: ["L10"],
  outlierDirection: ["L7"],
})
