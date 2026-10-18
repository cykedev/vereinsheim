// Text und Seitenbilder eines PDFs über Poppler (`pdftotext`, `pdftoppm`), für den Vergleich vorher und nachher.

import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const INSTALL =
  "Poppler fehlt: auf dem Mac `brew install poppler`, unter Debian/Ubuntu `apt install poppler-utils`"

function run(tool: string, args: string[]): string {
  const result = spawnSync(tool, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT")
    throw new Error(`${tool} nicht gefunden. ${INSTALL}`)
  if (result.status !== 0) throw new Error(`${tool} scheitert: ${result.stderr.trim()}`)
  return result.stdout
}

/** schreibt das PDF in einen eigenen Ordner, ruft `work` und räumt danach auf */
function withFile<T>(pdf: Uint8Array, work: (file: string, dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "vereinsheim-pdf-"))
  try {
    const file = join(dir, "in.pdf")
    writeFileSync(file, pdf)
    return work(file, dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** der Text des PDFs mit seinem Layout (`pdftotext -layout`), Seiten durch Seitenvorschub getrennt */
export function pdfText(pdf: Uint8Array): string {
  return withFile(pdf, (file) => run("pdftotext", ["-layout", file, "-"]))
}

/**
 * jede Seite als PNG mit 100 dpi nach `outDir` (`<prefix>-1.png`, `<prefix>-2.png` …); liefert die Pfade in der
 * Reihenfolge der Seiten
 */
export function pdfPages(pdf: Uint8Array, outDir: string, prefix = "seite"): string[] {
  withFile(pdf, (file) => run("pdftoppm", ["-png", "-r", "100", file, join(outDir, prefix)]))
  const page = (name: string) => Number(/-(\d+)\.png$/.exec(name)?.[1] ?? 0)
  return readdirSync(outDir)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".png"))
    .sort((a, b) => page(a) - page(b))
    .map((name) => join(outDir, name))
}
