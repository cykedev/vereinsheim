import { describe, expect, it } from "vitest"

import { selfImage } from "@/lib/statistics/selfImage"
import type { SelfImageValues } from "@/lib/statistics/sessions"

const values = (base: number, technique = base): SelfImageValues => ({
  fitness: base,
  nutrition: base,
  technique,
  tactics: base,
  mentalStrength: base,
  environment: base,
  equipment: base,
})

describe("Selbstbild", () => {
  it("Mittel von Prognose und Feedback je Bereich, nur über Einheiten mit beidem", () => {
    const image = selfImage([
      { prognosis: values(60, 80), feedback: values(70, 50) },
      { prognosis: values(40, 60), feedback: values(50, 50) },
      // nur Prognose: zählt nicht, sonst läge das Mittel der Prognose bei 33,3
      { prognosis: values(0), feedback: null },
      { prognosis: null, feedback: values(100) },
    ])
    expect(image.n).toBe(2)
    expect(image.rows.map((r) => r.label)).toEqual([
      "Kondition",
      "Ernährung",
      "Technik",
      "Taktik",
      "Mentale Stärke",
      "Umfeld",
      "Material",
    ])
    expect(image.rows[0]).toEqual({
      key: "fitness",
      label: "Kondition",
      prognosis: 50,
      feedback: 60,
      delta: 10,
    })
    // Technik: vorher zu gut eingeschätzt
    expect(image.rows[2]).toMatchObject({ prognosis: 70, feedback: 50, delta: -20 })
  })

  it("ohne Einheit mit Prognose und Feedback keine Zeilen", () => {
    expect(selfImage([{ prognosis: values(50), feedback: null }])).toEqual({ n: 0, rows: [] })
  })
})
