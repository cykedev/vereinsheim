// Bündelt den Kindprozess, der Ausdrucke liest (`src/lib/printouts/reader-child.ts`), mit `unpdf` und pdf.js zu einer
// Datei im Standalone-Build: `.next/standalone/apps/spiegel/printout-reader.mjs`. Dort liegt sie im Arbeitsverzeichnis
// des Servers (`server.js` wechselt dorthin) und fährt mit dem bestehenden `COPY .next/standalone` ins Image. Läuft nach
// `next build` (Skript `build`).

import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { build, type BuildOptions } from "esbuild"

const APP_DIR = fileURLToPath(new URL("..", import.meta.url))
const STANDALONE_APP = join(APP_DIR, ".next/standalone/apps/spiegel")

/** dieselben Optionen für den Build und den Test des Bündels (`reader-bundle.test.ts`) */
export function readerBuildOptions(outfile: string): BuildOptions {
  return {
    entryPoints: [join(APP_DIR, "src/lib/printouts/reader-child.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    outfile,
    // `unpdf` versucht zuerst `pdfjs-dist`, das hier fehlt; pdf.js kommt aus `unpdf/pdfjs`
    external: ["pdfjs-dist"],
    logLevel: "warning",
    legalComments: "none",
  }
}

async function main() {
  if (!existsSync(join(STANDALONE_APP, "server.js"))) {
    throw new Error("Kein Standalone-Build: erst next build")
  }
  const outfile = join(STANDALONE_APP, "printout-reader.mjs")
  await build(readerBuildOptions(outfile))
  const kb = Math.round(statSync(outfile).size / 1024)
  process.stdout.write(`printout-reader.mjs gebaut, ${kb} KB\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
