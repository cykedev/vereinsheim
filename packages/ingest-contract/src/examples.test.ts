import { readdirSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { parseSnapshot, type Snapshot } from "./parse"
import { CURRENT_CONTRACT_VERSION, SUPPORTED_CONTRACT_VERSIONS } from "./versions"

/**
 * Eingefrorene Beispiele (SF-69): Jede Datei unter `examples/v<n>/` bleibt gültig, solange Spiegel
 * Version n annimmt, und behält ihre Prüfsumme. Wer den Vertrag nicht-additiv ändert, bricht hier.
 * Beispiele werden nie geändert, nur ergänzt.
 */

const root = new URL("../examples/", import.meta.url)

const versionDirs = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
  .map((entry) => ({ name: entry.name, version: Number(entry.name.slice(1)) }))

function load(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(new URL(`${dir}/${file}`, root), "utf8"))
}

function parsed(dir: string, file: string): Snapshot {
  const result = parseSnapshot(load(dir, file))
  if (!result.ok) throw new Error(`${dir}/${file}: ${JSON.stringify(result.issues)}`)
  return result.value
}

describe("Vertragsversionen (SF-69)", () => {
  it("Spiegel nimmt die aktuelle und die vorige Version an", () => {
    expect(SUPPORTED_CONTRACT_VERSIONS).toContain(CURRENT_CONTRACT_VERSION)
    if (CURRENT_CONTRACT_VERSION > 1) {
      expect(SUPPORTED_CONTRACT_VERSIONS).toContain(CURRENT_CONTRACT_VERSION - 1)
    }
  })

  it("jede unterstützte Version hat eingefrorene Beispiele", () => {
    for (const version of SUPPORTED_CONTRACT_VERSIONS) {
      expect(versionDirs.map((dir) => dir.version)).toContain(version)
    }
  })
})

describe.each(versionDirs.filter((dir) => SUPPORTED_CONTRACT_VERSIONS.includes(dir.version)))(
  "Beispiele $name",
  ({ name, version }) => {
    const files = readdirSync(new URL(`${name}/`, root)).filter((file) => file.endsWith(".json"))

    it.each(files)("%s ist gültig, mit unveränderter Prüfsumme", (file) => {
      const snapshot = parsed(name, file)
      expect(snapshot.contractVersion).toBe(version)
    })

    it.each(files)("%s enthält nur synthetische Personendaten (ADR-029)", (file) => {
      const row = parsed(name, file).data.scheiben.rows[0]!
      expect(row.Nachname).toBe("Muster")
      expect(row.SportpassID).toBe("12345678")
    })
  }
)

describe("Beispiele v1: Abfolge einer Korrektur (SF-26, SF-27)", () => {
  const seq1 = parsed("v1", "korrektur-seq1.json")
  const seq2 = parsed("v1", "korrektur-seq2.json")
  const seq3 = parsed("v1", "unveraendert-seq3.json")

  it("gehört zu derselben Scheibe mit steigender Folgenummer", () => {
    expect(new Set([seq1.scheibenId, seq2.scheibenId, seq3.scheibenId]).size).toBe(1)
    expect(seq1.sequence).toBeLessThan(seq2.sequence)
    expect(seq2.sequence).toBeLessThan(seq3.sequence)
    expect(seq2.observedAt).not.toBe(seq3.observedAt)
  })

  it("eine Korrektur ändert die Prüfsumme", () => {
    expect(seq2.checksum).not.toBe(seq1.checksum)
  })

  it("ein unveränderter Stand behält sie, trotz neuer Folgenummer und Zeit", () => {
    expect(seq3.checksum).toBe(seq2.checksum)
  })
})

describe("Beispiele v1: Inhalte", () => {
  it("lg-training hat Probe und Wertung", () => {
    const stellungen = parsed("v1", "lg-training.json").data.treffer.rows.map((r) => r.Stellung)
    expect(stellungen).toContain("0")
    expect(stellungen).toContain("1")
  })

  it("nur-probe hat nur Probe und keine Serien", () => {
    const { data } = parsed("v1", "nur-probe.json")
    expect(data.serien.rows).toEqual([])
    expect(data.treffer.rows.length).toBeGreaterThan(0)
    expect(data.treffer.rows.every((r) => r.Stellung === "0")).toBe(true)
  })
})
