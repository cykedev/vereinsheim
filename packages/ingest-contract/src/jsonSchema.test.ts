import { readdirSync, readFileSync } from "node:fs"

import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"
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

/**
 * Unabhängige Gegenprobe: ajv statt Zod liest das geschriebene Schema so, wie es die Brücke in einer
 * anderen Sprache täte. Bisher war nur belegt, dass die Datei dem Zod-Export entspricht.
 */
describe("JSON-Schema mit ajv geprüft", () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true })
  addFormats(ajv)
  const load = (path: string): unknown =>
    JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
  const single = ajv.compile(load("schema/snapshot-v1.schema.json") as object)
  const batch = ajv.compile(load("schema/snapshot-batch-v1.schema.json") as object)

  const examples = readdirSync(new URL("../examples/v1/", import.meta.url)).map((file) => ({
    file,
    snapshot: load(`examples/v1/${file}`),
  }))
  const invalid = (
    load("test-vectors/invalid-v1.json") as { cases: { name: string; snapshot: unknown }[] }
  ).cases

  // Was JSON-Schema nicht ausdrückt (description des Schemas); diese Fälle fängt nur parseSnapshot.
  const onlyParser = [
    "zeile-ohne-spalte",
    "zeile-mit-fremder-spalte",
    "zeile-mit-vertauschter-spalte",
    "einzelnes-surrogat",
    "zelle-zu-lang-utf16",
    "proto-in-zeile",
    "proto-als-spalte",
    "falsche-pruefsumme",
    "data-nach-pruefsumme-geaendert",
  ]

  it.each(examples)("nimmt das Beispiel $file an", ({ snapshot }) => {
    expect(single(snapshot), JSON.stringify(single.errors)).toBe(true)
  })

  it("nimmt alle Beispiele als eine Lieferung an", () => {
    const snapshots = examples.map((example) => example.snapshot)
    expect(batch({ snapshots }), JSON.stringify(batch.errors)).toBe(true)
  })

  it.each(invalid)("$name: lehnt ab, was das Schema ausdrücken kann", ({ name, snapshot }) => {
    expect(single(snapshot)).toBe(onlyParser.includes(name))
  })

  it("kennt jeden Fall, der nur im Parser liegt", () => {
    expect(onlyParser.filter((name) => !invalid.some((c) => c.name === name))).toEqual([])
  })
})
