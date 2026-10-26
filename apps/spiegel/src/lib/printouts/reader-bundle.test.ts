import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { buildPdf } from "@vereinsheim/meyton-pdf/test-pdf"
import { build } from "esbuild"
import { afterAll, describe, expect, it } from "vitest"

import { readerBuildOptions } from "../../../tools/build-reader"
import { CHILD_MAX_RSS_MB, readPrintoutIsolated } from "./reader"

// Das Bündel für Produktion, gebaut mit denselben Optionen wie nach `next build`, liest einen erfundenen Ausdruck.

let dir: string | null = null

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe("printout-reader.mjs", () => {
  it("liest einen Qt-Ausdruck mit dem Bündel, unter der Grenze für den Speicher", async () => {
    dir = await mkdtemp(join(tmpdir(), "spiegel-reader-"))
    const bundle = join(dir, "printout-reader.mjs")
    await build(readerBuildOptions(bundle))
    const pdf = await buildPdf({
      pages: [[{ str: "ID: ff914420 - Seite: 1", x: 258, y: 26 }]],
      font: "identity-h",
      info: { CreationDate: "D:20261002195212+02'00'" },
    })
    const result = await readPrintoutIsolated(pdf, { script: bundle })
    expect(result).toMatchObject({ kind: "read", id: { kind: "found", hex: "ff914420" } })
    if (result.kind === "read") expect(result.maxRssKb).toBeLessThan(CHILD_MAX_RSS_MB * 1024)
  }, 30_000)
})
