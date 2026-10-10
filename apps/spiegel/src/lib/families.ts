import type { FamilyId } from "@vereinsheim/shot-core/discipline"

/** Anzeige der Familien aus dem Fachkern; die Kennung steht in der Adresse (`?family=lp-freihand`) */
export const FAMILY_NAMES: Readonly<Record<FamilyId, string>> = {
  "lp-freihand": "Luftpistole",
  "lp-auflage": "Luftpistole Auflage",
  "lg-freihand": "Luftgewehr",
  "lg-auflage": "Luftgewehr Auflage",
}
