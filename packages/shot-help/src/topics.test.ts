import { ANALYSIS_CATALOG } from "@vereinsheim/shot-core/analysis"
import { METRICS } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import { HELP_TOPICS } from "./topics"
import type { HelpTheme } from "./types"

/** Reihenfolge der Themen in der Oberfläche */
const THEMES: readonly HelpTheme[] = [
  "result",
  "precision",
  "position",
  "time",
  "sighters",
  "coverage",
]
const CATALOG_ID = /^[EPLVZISTRCKWQ]\d+$/
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
    const order = HELP_TOPICS.map((topic) => THEMES.indexOf(topic.theme))
    expect(order.every((value) => value >= 0)).toBe(true)
    expect(order.every((value, i) => i === 0 || value >= order[i - 1])).toBe(true)
    expect(new Set(order).size).toBe(THEMES.length)
  })
})
