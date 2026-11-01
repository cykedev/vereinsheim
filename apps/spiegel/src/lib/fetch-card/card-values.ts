// Die Werte einer Scheibe aus einem Ausdruck: für eine neue Scheibe vom Ausdruck (`fetchCard`, `importPrintoutIn`) und für
// eine Scheibe aus Treffsicher, die ein passender Ausdruck ergänzt (`adoptPrintoutValues`). Rein.

import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"

import type { StoredPrintout } from "../printouts/store"
import { detailsFromReading } from "../printouts/values"

/**
 * Die Angaben einer neuen Scheibe aus dem Ausdruck: stimmt die Lesung mit dem Scheibenbild der Disziplin, ihre Werte
 * und die Standnummer; sonst keine (`inconsistent`, wenn der Ausdruck eine Lesung hatte)
 */
export function newCardValues(file: StoredPrintout | null, targetId: string | null) {
  const reading = file?.values.reading ?? null
  if (reading === null) return { details: {}, stand: undefined, inconsistent: false }
  const result = detailsFromReading(
    reading,
    targetId !== null && Object.hasOwn(TARGETS, targetId) ? (targetId as TargetId) : null
  )
  return result.ok
    ? { details: result.details, stand: result.stand, inconsistent: false }
    : { details: {}, stand: undefined, inconsistent: true }
}
