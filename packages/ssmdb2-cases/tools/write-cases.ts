// Schreibt die Fälle nach `cases/v1` (alte Dateien weg): pnpm --filter @vereinsheim/ssmdb2-cases cases

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { allCaseFiles, CASES_DIR } from "../src/freeze"

const out = (text = "") => process.stdout.write(`${text}\n`)

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
rmSync(join(root, CASES_DIR), { recursive: true, force: true })
const files = allCaseFiles()
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}
out(`${Object.keys(files).length} Dateien unter ${CASES_DIR}`)
