// Alle Fälle, in der Reihenfolge des Zuschnitts (SP-1.0 b).

import { COMPLETENESS_CASES } from "./completeness"
import { PROBE_CASES } from "./probe"
import { REVISION_CASES } from "./revisions"
import { VALUE_CASES } from "./values"

export { runCase, type CaseDefinition, type CaseOutput } from "./case"

export const CASES = [...PROBE_CASES, ...COMPLETENESS_CASES, ...VALUE_CASES, ...REVISION_CASES]
