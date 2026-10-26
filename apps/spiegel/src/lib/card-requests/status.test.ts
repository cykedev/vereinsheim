import { describe, expect, it } from "vitest"

import { CardRequestStatus } from "@/generated/prisma/enums"

import { isRemovable } from "./status"

describe("isRemovable", () => {
  it("beendet ohne Scheibe lässt sich entfernen, wartend und geholt nicht; ein neuer Zustand fällt auf", () => {
    const all = Object.values(CardRequestStatus)
    expect(all.filter(isRemovable).sort()).toEqual([
      "expired",
      "held",
      "mismatch",
      "missing",
      "taken",
      "withdrawn",
    ])
    expect(all.filter((status) => !isRemovable(status)).sort()).toEqual(["done", "open"])
  })
})
