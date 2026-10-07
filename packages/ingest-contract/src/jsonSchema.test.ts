import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { renderJsonSchemas } from "./jsonSchema"
import { LIMITS } from "./limits"

describe("JSON-Schema unter schema/", () => {
  const rendered = Object.entries(renderJsonSchemas())

  it.each(rendered)("%s ist das aus Zod erzeugte", (file, schema) => {
    const committed: unknown = JSON.parse(
      readFileSync(new URL(`../schema/${file}`, import.meta.url), "utf8")
    )
    expect(committed, "Schema veraltet: pnpm --filter @vereinsheim/ingest-contract schema").toEqual(
      schema
    )
  })

  it("enthält die Grenzen und verbietet unbekannte Felder", () => {
    const text = JSON.stringify(renderJsonSchemas()["snapshot-v1.schema.json"])
    expect(text).toContain(`"maxItems":${LIMITS.maxTrefferRows}`)
    expect(text).toContain(`"maxProperties":${LIMITS.maxColumns}`)
    expect(text).toContain(`"maxLength":${LIMITS.maxCellLength}`)
    expect(text).toContain('"additionalProperties":false')
    expect(text).toContain("sha256")
  })
})
