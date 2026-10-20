import { describe, expect, it } from "vitest"

import { isShareId, sharePath } from "./share"

const ID = "3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c"

describe("isShareId", () => {
  it("nimmt eine UUID in Kleinbuchstaben, wie Postgres und `randomUUID` sie schreiben", () => {
    expect(isShareId(ID)).toBe(true)
    expect(isShareId(crypto.randomUUID())).toBe(true)
  })

  it("lehnt alles andere ab, bevor eine Abfrage läuft", () => {
    for (const value of [
      ID.toUpperCase(),
      `${ID}0`,
      ID.slice(1),
      ID.replaceAll("-", ""),
      "cmgxk2v3c0000abcd1234efgh",
      "",
      "../cards",
      ` ${ID}`,
      null,
      undefined,
      42,
    ])
      expect(isShareId(value)).toBe(false)
  })
})

describe("sharePath", () => {
  it("die Adresse der geteilten Scheibe", () => {
    expect(sharePath(ID)).toBe(`/share/${ID}`)
  })
})
