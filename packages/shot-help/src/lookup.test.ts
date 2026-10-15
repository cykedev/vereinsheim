import { describe, expect, it } from "vitest"

import { helpForCatalog, helpForMetric, helpTopic } from "./lookup"

describe("Nachschlagen", () => {
  it("findet ein Thema über seine ID", () => {
    expect(helpTopic("form-der-gruppe")?.title).toBe("Form der Gruppe")
    expect(helpTopic("gibt-es-nicht")).toBeUndefined()
  })

  it("findet das eine Thema zu einer Registry-Kennzahl", () => {
    expect(helpForMetric("group.sigma")?.id).toBe("praezision-sigma")
    expect(helpForMetric("result.decimal")?.id).toBe("ergebnis")
    expect(helpForMetric("gibt.es.nicht")).toBeUndefined()
    // keine Hilfe für eine Kennzahl, die es nicht gibt
    expect(helpForMetric("group.meanRadius")).toBeUndefined()
  })

  it("findet alle Themen zu einer Katalog-ID, in der Reihenfolge der Oberfläche", () => {
    expect(helpForCatalog("I1").map((topic) => topic.id)).toEqual([
      "serien-und-konstanz",
      "serien-im-vergleich",
    ])
    expect(helpForCatalog("X99")).toEqual([])
  })
})
