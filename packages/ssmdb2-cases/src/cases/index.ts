// Alle Fälle, in der Reihenfolge des Zuschnitts (SP-1.0 b).

import { COMPLETENESS_CASES } from "./completeness"
import { PROBE_CASES } from "./probe"

export { runCase, type CaseDefinition, type CaseOutput } from "./case"

export const CASES = [...PROBE_CASES, ...COMPLETENESS_CASES]
