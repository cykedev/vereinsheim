import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { build } from "esbuild"
import { afterAll, describe, expect, it } from "vitest"

import { valuedPrintout } from "../../../test/printout"
import { readerBuildOptions } from "../../../tools/build-reader"
import { CHILD_MAX_RSS_MB, readPrintoutIsolated } from "./reader"

// Das Bündel für Produktion, gebaut mit denselben Optionen wie nach `next build`, liest einen erfundenen Ausdruck samt
// Werten.

let dir: string | null = null

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
})

describe("printout-reader.mjs", () => {
  it("liest einen Qt-Ausdruck samt Werten mit dem Bündel, unter der Grenze für den Speicher", async () => {
    dir = await mkdtemp(join(tmpdir(), "spiegel-reader-"))
    const bundle = join(dir, "printout-reader.mjs")
    await build(readerBuildOptions(bundle))
    const result = await readPrintoutIsolated(await valuedPrintout(), { script: bundle })
    expect(result).toMatchObject({
      kind: "read",
      id: { kind: "found", hex: "ff914420" },
      values: { kind: "ok", reading: { layout: "qt" } },
    })
    if (result.kind === "read") expect(result.maxRssKb).toBeLessThan(CHILD_MAX_RSS_MB * 1024)
  }, 30_000)
})
