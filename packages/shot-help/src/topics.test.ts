import { ANALYSIS_CATALOG } from "@vereinsheim/shot-core/analysis"
import { CATALOG_ID, METRICS } from "@vereinsheim/shot-core/metrics"
import { wilson } from "@vereinsheim/shot-core/stats"
import { describe, expect, it } from "vitest"

import { helpForCatalog, helpForMetric } from "./lookup"
import { THEME_ORDER } from "./markdown"
import { HELP_TOPICS } from "./topics"

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

describe("HELP_TOPICS: nichts fehlt", () => {
  it("jede Registry-Kennzahl gehört zu genau einem Thema", () => {
    for (const metric of METRICS) {
      const owners = HELP_TOPICS.filter((topic) => topic.metrics.includes(metric.key))
      expect(
        owners.map((topic) => topic.id),
        metric.key
      ).toHaveLength(1)
    }
  })

  it("das Thema einer Kennzahl nennt ihre Katalog-ID, sonst fände die Suche nach der ID es nicht", () => {
    for (const metric of METRICS) {
      expect(helpForMetric(metric.key)?.catalog, metric.key).toContain(metric.catalogId)
      expect(
        helpForCatalog(metric.catalogId).map((topic) => topic.id),
        metric.key
      ).toContain(helpForMetric(metric.key)?.id)
    }
  })

  it("jede Katalog-ID einer Auswertung hat mindestens eine Erklärung", () => {
    const covered = new Set(HELP_TOPICS.flatMap((topic) => topic.catalog))
    for (const [name, ids] of Object.entries(ANALYSIS_CATALOG)) {
      for (const id of ids) expect(covered.has(id), `${name}: ${id}`).toBe(true)
    }
  })
})

describe("HELP_TOPICS: Bezüge und Ordnung", () => {
  it("nur bekannte Registry-Schlüssel, Katalog-IDs in der Form des Katalogs", () => {
    const keys = new Set(METRICS.map((metric) => metric.key))
    for (const topic of HELP_TOPICS) {
      for (const key of topic.metrics) expect(keys.has(key), `${topic.id}: ${key}`).toBe(true)
      for (const id of topic.catalog) expect(id, topic.id).toMatch(CATALOG_ID)
    }
  })

  it("jede Katalog-ID eines Themas gehört zu einer Auswertung oder Kennzahl", () => {
    // fällt eine Auswertung oder Kennzahl weg, darf keine Erklärung mehr auf ihre ID zeigen
    const live = new Set([
      ...Object.values(ANALYSIS_CATALOG).flat(),
      ...METRICS.map((metric) => metric.catalogId),
    ])
    for (const topic of HELP_TOPICS) {
      for (const id of topic.catalog) expect(live.has(id), `${topic.id}: ${id}`).toBe(true)
    }
  })

  it("26 Themen: 21 einer Scheibe (ohne Lageanteil und ohne Probe) und 5 über viele Scheiben", () => {
    expect(HELP_TOPICS).toHaveLength(26)
    for (const id of ["probe-umfang", "probe-gegen-wertung", "eingeschossen"])
      expect(
        HELP_TOPICS.some((topic) => topic.id === id),
        id
      ).toBe(false)
    expect(HELP_TOPICS.filter((topic) => topic.theme === "period")).toHaveLength(5)
    expect(HELP_TOPICS.some((topic) => topic.id === "lageanteil")).toBe(false)
  })

  it("jedes Thema deckt mindestens eine Kennzahl oder Katalog-ID ab", () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.metrics.length + topic.catalog.length, topic.id).toBeGreaterThan(0)
    }
  })

  it("IDs eindeutig und in kebab-case, Titel eindeutig", () => {
    const ids = HELP_TOPICS.map((topic) => topic.id)
    for (const id of ids) expect(id).toMatch(KEBAB)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(HELP_TOPICS.map((topic) => topic.title)).size).toBe(HELP_TOPICS.length)
  })

  it("nach Thema gruppiert, in der Reihenfolge der Oberfläche", () => {
    const order = HELP_TOPICS.map((topic) => THEME_ORDER.indexOf(topic.theme))
    expect(order.every((value) => value >= 0)).toBe(true)
    expect(order.every((value, i) => i === 0 || value >= order[i - 1])).toBe(true)
    expect(new Set(order).size).toBe(THEME_ORDER.length)
  })
})

describe("Zahlen in Texten, exakt nachgerechnet", () => {
  const text = (id: string) => JSON.stringify(HELP_TOPICS.find((topic) => topic.id === id))

  it("Quoten: 20 Zehner aus 40 Schuss, 95-%-Bereich etwa 35 % bis 65 % (Wilson)", () => {
    const range = wilson(20, 40)!
    expect(Math.round(range.low * 100)).toBe(35)
    expect(Math.round(range.high * 100)).toBe(65)
    expect(text("quoten")).toContain(
      "Bei 20 Zehnern aus 40 Schuss reicht er etwa von 35 % bis 65 %."
    )
  })
})

describe("eine Scheibe sagt, was sie zeigt", () => {
  it("kein Auftrag, über mehrere Scheiben oder Abende zu vergleichen (das sagt nur der Leitfaden)", () => {
    for (const topic of HELP_TOPICS)
      for (const field of ["read", "act", "caution"] as const)
        expect(topic[field] ?? "", `${topic.id}.${field}`).not.toMatch(
          /Vergleich über mehrere|über mehrere (Scheiben|Abende)|auf mehreren Scheiben/
        )
  })

  it("Pausen: das Urteil steht in der Erklärung", () => {
    const pauses = HELP_TOPICS.find((topic) => topic.id === "pausen")!
    expect(pauses.read).toBe(
      "Ein Plus heißt: Nach der Pause warst du besser als sonst, ein Minus: schwächer. „Klar stärker“ oder „klar schwächer“ steht nur, wenn ein Test es zeigt."
    )
    expect(pauses.caution).toMatch(
      / Deshalb steht „klar“ erst bei einem großen Unterschied\. Eine kleine Wirkung der Pause zeigt eine Scheibe nicht\. Auch ein klares Urteil gilt nur für diese Pause\.$/
    )
    expect(pauses.formula).toContain("Permutationstest")
  })

  it("Ermüdung: das Urteil steht in der Erklärung", () => {
    const tired = HELP_TOPICS.find((topic) => topic.id === "ermuedung")!
    expect(tired.read).toContain(
      "„Klar schwächer“ oder „klar stärker“ steht nur, wenn ein Test es zeigt."
    )
    expect(tired.caution).toMatch(/Auch dann gilt es nur für diesen Abend\.$/)
    expect(tired.formula).toContain("Mann-Whitney")
  })
})
