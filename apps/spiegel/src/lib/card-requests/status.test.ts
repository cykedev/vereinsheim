import { describe, expect, it } from "vitest"

import { CardRequestStatus } from "@/generated/prisma/enums"

import { isRemovable } from "./status"

describe("isRemovable", () => {
  it("beendet ohne Scheibe lässt sich entfernen, wartend und geholt nicht; ein neuer Zustand fällt auf", () => {
    const all = Object.values(CardRequestStatus)
    expect(all.filter((status) => isRemovable(status, false)).sort()).toEqual([
      "expired",
      "held",
      "mismatch",
      "missing",
      "taken",
      "withdrawn",
    ])
    expect(all.filter((status) => !isRemovable(status, false)).sort()).toEqual(["done", "open"])
  })

  it("mit Scheibe nie, auch wenn der Auftrag ohne Erfolg endete", () => {
    expect(Object.values(CardRequestStatus).filter((status) => isRemovable(status, true))).toEqual(
      []
    )
  })
})
