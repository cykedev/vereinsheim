import { describe, expect, it } from "vitest"

import { exportTreffsicherSource, parseOwners } from "./source-export"

const account = JSON.stringify({
  user: { id: "u1", email: "Erfunden@Example.invalid" },
  sessions: [],
})

describe("exportTreffsicherSource", () => {
  it("leere Eingabe heißt kein Konto", async () => {
    expect(
      await exportTreffsicherSource({ account: "\n", owners: "" }).readAccount("a@example.invalid")
    ).toBeNull()
  })

  it("liefert den Export, wenn die E-Mail passt, ohne Groß- und Kleinschreibung und Rand", async () => {
    const source = exportTreffsicherSource({ account: `${account}\n`, owners: "" })
    expect(await source.readAccount(" erfunden@example.invalid ")).toEqual(JSON.parse(account))
  })

  it("ein Export eines anderen Kontos wirft", async () => {
    const source = exportTreffsicherSource({ account, owners: "" })
    await expect(source.readAccount("andere@example.invalid")).rejects.toThrow(
      "Export passt nicht zur E-Mail"
    )
  })

  it("hat kein markMoved: das Merkmal setzt der Aufrufer", () => {
    expect(exportTreffsicherSource({ account, owners: "" }).markMoved).toBeUndefined()
  })

  it("die Besitzer gefiltert nach den gefragten Kennungen", async () => {
    const source = exportTreffsicherSource({ account, owners: "s1|u1\ns2|u2\n" })
    expect(await source.sessionOwners(["s2", "s3"])).toEqual(new Map([["s2", "u2"]]))
  })
})

describe("parseOwners", () => {
  it("überspringt leere Zeilen", () => {
    expect(parseOwners("a|u1\n\n  \nb_2|u-2\n")).toEqual(
      new Map([
        ["a", "u1"],
        ["b_2", "u-2"],
      ])
    )
  })

  it("eine ungültige Kennung wirft mit Zeilennummer", () => {
    expect(() => parseOwners("a|u1\nb c|u2")).toThrow("Zeile 2")
    expect(() => parseOwners("a|u1|x")).toThrow("Zeile 1")
    expect(() => parseOwners("a")).toThrow("Zeile 1")
  })
})
