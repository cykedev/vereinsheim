import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { CASES } from "./cases/index"
import { allCaseFiles, CASES_DIR } from "./freeze"

const root = fileURLToPath(new URL("..", import.meta.url))
const STALE = "Fälle veraltet: pnpm --filter @vereinsheim/ssmdb2-cases cases"

function filesOnDisk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesOnDisk(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}

/** die Sonderfälle mit SSMDB2-Bezug aus dem Zuschnitt (Roadmap SP-1.0 b), dazu SF-32 aus der Abnahme der Brücke */
const REQUIRED = [
  ...["01", "02", "03", "04", "05", "72"],
  ...["07", "08", "09", "10", "11", "13"],
  ...["14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "71", "74"],
  ...["30", "32", "73", "77", "78"],
  ...["35", "36"],
].map((n) => `SF-${n}`)

describe("eingefrorene Fälle (cases/v1)", () => {
  const generated = allCaseFiles()

  it("jede Datei wie neu erzeugt, keine fehlt, keine zu viel", () => {
    const onDisk = filesOnDisk(join(root, CASES_DIR)).map((f) => relative(root, f))
    expect(onDisk.sort(), STALE).toEqual(Object.keys(generated).sort())
    for (const [path, content] of Object.entries(generated))
      expect(readFileSync(join(root, path), "utf8"), `${STALE} (${path})`).toBe(content)
  })

  it("jeder Sonderfall des Zuschnitts und SF-32 hat genau einen Fall", () => {
    expect(REQUIRED).toHaveLength(31)
    expect(CASES.map((c) => c.id).sort()).toEqual([...REQUIRED].sort())
  })

  it("nur erfundene Personen (ADR-029)", () => {
    const people = new Set<string>()
    for (const [path, content] of Object.entries(generated)) {
      if (!path.endsWith("snapshots.json")) continue
      for (const reading of JSON.parse(content))
        for (const snapshot of reading.snapshots)
          for (const row of snapshot.data.scheiben.rows)
            people.add(
              `${row.Nachname}|${row.Vorname}|${row.SportpassID}|${row.Verein}|${row.VereinsID}`
            )
    }
    expect([...people].sort()).toEqual([
      "--frei--||0|SV Musterstadt|999999",
      "Beispiel|Anna|12345678|SV Musterstadt|999999",
      "Beispiel|Anna|2147483647|SV Musterstadt|999999",
      "Muster|Erika|12345678|SV Musterstadt|999999",
      "Muster|Max|0|SV Musterstadt|999999",
      "Muster|Max|12345678|SV Musterstadt|999999",
      "Muster|Max|2147483647|SV Musterstadt|999999",
      "unknown|unknown|12345678|SV Musterstadt|999999",
    ])
  })
})
