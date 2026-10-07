import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { canonicalData, computeChecksum } from "./checksum"
import { snapshotDataV1 } from "./v1/snapshot"

type Vector = {
  name: string
  description: string
  sameChecksumAs?: string
  differentChecksumFrom?: string
  data: unknown
  canonical: string
  checksum: string
}

const file = JSON.parse(
  readFileSync(new URL("../test-vectors/checksum-v1.json", import.meta.url), "utf8")
) as { contractVersion: number; vectors: Vector[] }

const byName = new Map(file.vectors.map((vector) => [vector.name, vector]))

describe("Testvektoren der Prüfsumme (SF-27)", () => {
  it("gehören zu Vertrag v1 und haben eindeutige Namen", () => {
    expect(file.contractVersion).toBe(1)
    expect(byName.size).toBe(file.vectors.length)
    expect(file.vectors.length).toBeGreaterThanOrEqual(12)
  })

  describe.each(file.vectors.map((vector) => [vector.name, vector] as const))("%s", (_, vector) => {
    const data = snapshotDataV1.parse(vector.data)

    it("ist gültiges data nach Vertrag v1", () => {
      expect(snapshotDataV1.safeParse(vector.data).success).toBe(true)
    })

    it("ergibt genau die kanonische Form", () => {
      expect(canonicalData(data)).toBe(vector.canonical)
    })

    it("ergibt genau die Prüfsumme", () => {
      expect(computeChecksum(data)).toBe(vector.checksum)
    })

    if (vector.sameChecksumAs) {
      const other = vector.sameChecksumAs
      it(`hat dieselbe Prüfsumme wie ${other}`, () => {
        expect(vector.checksum).toBe(byName.get(other)?.checksum)
      })
    }

    if (vector.differentChecksumFrom) {
      const other = vector.differentChecksumFrom
      it(`hat eine andere Prüfsumme als ${other}`, () => {
        expect(byName.get(other)?.checksum).toMatch(/^sha256:/)
        expect(vector.checksum).not.toBe(byName.get(other)?.checksum)
      })
    }
  })

  it("alle Prüfsummen außer den als gleich markierten sind verschieden", () => {
    const distinct = file.vectors.filter((vector) => !vector.sameChecksumAs)
    expect(new Set(distinct.map((vector) => vector.checksum)).size).toBe(distinct.length)
  })
})
