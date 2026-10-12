import { describe, expect, it } from "vitest"

import { addressScoring, nextCardAddress } from "./card-address"

const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash })

describe("nextCardAddress", () => {
  it("zurück zur Vorgabe (ganze Scheibe, Zehntel) schreibt die kürzere Adresse, der Anker bleibt", () => {
    expect(
      nextCardAddress(
        at("/cards/a", "?from=list&series=2", "#analysis/time"),
        "/cards/a?from=list",
        false
      )
    ).toBe("/cards/a?from=list#analysis/time")
    expect(nextCardAddress(at("/cards/a", "?scoring=rings"), "/cards/a", false)).toBe("/cards/a")
  })
  it("gleiche Adresse: nichts zu tun, auch mit Anker aus dem Laden", () => {
    expect(
      nextCardAddress(at("/cards/a", "?from=list", "#shots"), "/cards/a?from=list", false)
    ).toBeNull()
  })
  it("ein gewählter Reiter steht in der Adresse und ersetzt den Anker", () => {
    expect(
      nextCardAddress(
        at("/cards/a", "?from=list", "#shots"),
        "/cards/a?from=list#analysis/time",
        true
      )
    ).toBe("/cards/a?from=list#analysis/time")
    expect(
      nextCardAddress(
        at("/cards/a", "?from=list", "#analysis/time"),
        "/cards/a?from=list#analysis/time",
        true
      )
    ).toBeNull()
  })
})

describe("addressScoring", () => {
  it("die Wertung steht nur in der Adresse, solange sie nicht die der Scheibe ist", () => {
    expect(addressScoring("rings", "rings")).toBeNull()
    expect(addressScoring("decimal", "decimal")).toBeNull()
    expect(addressScoring("rings", "decimal")).toBe("rings")
    expect(addressScoring("decimal", "rings")).toBe("decimal")
  })
})
