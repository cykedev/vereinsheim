import { forbiddenIn } from "@vereinsheim/lib/wording"
import { describe, expect, it } from "vitest"

import { TREFFSICHER_OLD_WORDS } from "./consequences"
import { MISSING_KINDS, missingReason } from "./missing"

describe("missingReason", () => {
  it("der freigegebene Grund je Stelle", () => {
    expect(missingReason("sessionResult")).toBe("noch kein Ergebnis eingetragen")
    expect(missingReason("seriesResult")).toBe("ohne Ergebnis")
    expect(missingReason("shots")).toBe("ohne Einzelschüsse")
    expect(missingReason("quality")).toBe("nicht bewertet")
    expect(missingReason("name")).toBe("ohne Namen")
    expect(missingReason("lastSessionEdit")).toBe("noch keine Einheit")
  })

  it("Gründe nach den Schreibregeln", () => {
    expect(forbiddenIn(MISSING_KINDS.map(missingReason), TREFFSICHER_OLD_WORDS)).toEqual([])
  })
})
