/// <reference types="node" />

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { readPrintout } from "../printout"
import { readPrintoutValues } from "./read"
import { printoutReading, type ReadingResult } from "./reading"

// Eigene Ausdrucke als lokale Regression ([[meyton-printout]], ADR-029 Nachtrag): Die PDFs liegen nur lokal im
// gitignorten Ordner `__fixtures__/private/printouts/`, je Datei daneben die Lesung als Schnappschuss (ohne Name,
// Nummer, ID und Datum). Ändert Meyton das Layout oder der Leser sein Verhalten, fällt ein Schnappschuss. Ohne Ordner
// (CI, fremde Rechner) läuft nichts.

const FOLDER = join(__dirname, "..", "__fixtures__", "private", "printouts")
const files = existsSync(FOLDER)
  ? readdirSync(FOLDER)
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .sort()
  : []

const suite = files.length > 0 ? describe : describe.skip

suite("eigene Ausdrucke (lokal, ohne Ordner übersprungen)", () => {
  const results = new Map<string, ReadingResult>()

  it.each(files)("%s", async (file) => {
    const bytes = new Uint8Array(readFileSync(join(FOLDER, file)))
    const [values, printout] = await Promise.all([readPrintoutValues(bytes), readPrintout(bytes)])
    const result = printoutReading(values, { producer: printout.producer })
    results.set(file, result)
    await expect(`${JSON.stringify(result, null, 2)}\n`).toMatchFileSnapshot(
      join(FOLDER, `${file.replace(/\.pdf$/i, "")}.reading.json`)
    )
  })

  it("mindestens 90 % mit Werten", () => {
    const ok = [...results.values()].filter((result) => result.kind === "ok").length
    expect(results.size).toBe(files.length)
    expect(ok / files.length).toBeGreaterThanOrEqual(0.9)
  })
})
