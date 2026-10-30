// Bündelt den Einstieg der Übernahme für den Container des Betriebs (`tools/transfer-ops.ts`) samt Prisma-Client und
// `pg` zu einer Datei im Standalone-Build: `.next/standalone/apps/spiegel/transfer.mjs`, neben `printout-reader.mjs`, das
// der Lauf über `process.cwd()` findet. Fährt mit dem bestehenden `COPY .next/standalone` ins Image; gestartet nur über
// den Dienst `transfer-spiegel` (`compose.yml`). Läuft nach `next build` (Skript `build`).

import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { build, type BuildOptions } from "esbuild"

const APP_DIR = fileURLToPath(new URL("..", import.meta.url))
const STANDALONE_APP = join(APP_DIR, ".next/standalone/apps/spiegel")

/** dieselben Optionen für den Build und den Test des Bündels (`tools/transfer/bundle.test.ts`) */
export function transferBuildOptions(outfile: string): BuildOptions {
  return {
    entryPoints: [join(APP_DIR, "tools/transfer-ops.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    outfile,
    // `pg` lädt `pg-native` nur auf Wunsch; es ist nicht installiert
    external: ["pg-native"],
    // `pg` und andere CommonJS-Pakete laden Builtins per `require`, das es in ESM nicht gibt
    banner: {
      js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);',
    },
    logLevel: "warning",
    legalComments: "none",
  }
}

async function main() {
  if (!existsSync(join(STANDALONE_APP, "server.js"))) {
    throw new Error("Kein Standalone-Build: erst next build")
  }
  const outfile = join(STANDALONE_APP, "transfer.mjs")
  await build(transferBuildOptions(outfile))
  const kb = Math.round(statSync(outfile).size / 1024)
  process.stdout.write(`transfer.mjs gebaut, ${kb} KB\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
