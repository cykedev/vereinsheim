import { writeFileSync } from "node:fs"

import { renderJsonSchemas } from "../src/jsonSchema"

for (const [file, schema] of Object.entries(renderJsonSchemas())) {
  writeFileSync(
    new URL(`../schema/${file}`, import.meta.url),
    `${JSON.stringify(schema, null, 2)}\n`
  )
  console.log(`schema/${file}`)
}
