import { writeFileSync } from "node:fs"

import { renderJsonSchemas } from "../src/jsonSchema"

const out = (text = "") => process.stdout.write(`${text}\n`)

for (const [file, schema] of Object.entries(renderJsonSchemas())) {
  writeFileSync(
    new URL(`../schema/${file}`, import.meta.url),
    `${JSON.stringify(schema, null, 2)}\n`
  )
  out(`schema/${file}`)
}
