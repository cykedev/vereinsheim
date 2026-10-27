// Schreibt einen erfundenen Meyton-Ausdruck (Qt-Weg, ID und Druckzeit wählbar, Vorgabe ff914420) als PDF nach stdout. Für
// den Stack-Test (`tools/stack-e2e/ops.sh`), die Skriptprüfung („Scheibe holen“, `samplePrintout`) und zum Messen des
// Lesers von Hand; mit `--values` ein in sich stimmiger Ausdruck mit Werten und Trefferbild (LP 40, Wertung, 40 Schuss,
// `valuedPrintout`), mit `--kind memory|time` eine der präparierten Bomben. Kein echter Ausdruck (ADR-029).
//
//   pnpm exec tsx tools/printout-sample.ts --values | node .next/standalone/apps/spiegel/printout-reader.mjs
//   pnpm exec tsx tools/printout-sample.ts --id 7fff0a09 --printed 2026-10-27T19:30:00+01:00 > ausdruck.pdf

import { bombContent, buildPdf } from "@vereinsheim/meyton-pdf/test-pdf"

import { valuedPrintout } from "../test/printout"

const PRODUCER = "Qt 5.12.8"
const ISO = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)([+-])(\d\d):(\d\d)$/

/** die Erstellzeit eines PDFs (`D:JJJJMMTTHHmmSS+HH'mm'`) aus einer Zeit mit Versatz („2026-10-02T19:52:12+02:00“) */
export function pdfDate(printed: string): string {
  const m = ISO.exec(printed)
  if (!m) throw new Error(`${printed}: Zeit mit Versatz erwartet, etwa 2026-10-02T19:52:12+02:00`)
  return `D:${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}${m[7]}${m[8]}'${m[9]}'`
}

/** ein erfundener Ausdruck mit ID im Fuß und Druckzeit */
export async function samplePrintout({
  hex = "ff914420",
  printed = "2026-10-02T19:52:12+02:00",
}: { hex?: string; printed?: string } = {}): Promise<Uint8Array> {
  return buildPdf({
    pages: [
      [
        { str: "LP 40", x: 57, y: 782 },
        { str: "Serie 1: 10,5 10,3 9,8 10,1 9,6 10,0", x: 153, y: 700 },
        { str: `ID: ${hex} - Seite: 1`, x: 258, y: 26 },
      ],
    ],
    font: "identity-h",
    info: { CreationDate: pdfDate(printed), Producer: PRODUCER },
  })
}

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

function kindOf(argv: readonly string[]): "sample" | "memory" | "time" {
  const kind = option(argv, "--kind") ?? "sample"
  if (kind === "sample" || kind === "memory" || kind === "time") return kind
  throw new Error("--kind memory|time")
}

async function main() {
  const argv = process.argv.slice(2)
  const kind = kindOf(argv)
  const hex = option(argv, "--id")
  const printed = option(argv, "--printed")
  const pdf =
    kind === "sample" && argv.includes("--values")
      ? await valuedPrintout({
          layout: "qt",
          id: hex,
          printed: pdfDate(printed ?? "2026-10-02T19:52:12+02:00"),
        })
      : kind === "sample"
        ? await samplePrintout({ hex, printed })
        : await buildPdf({
            pages: [[]],
            rawPages: [bombContent(kind)],
            info: { CreationDate: pdfDate("2026-10-02T19:52:12+02:00"), Producer: PRODUCER },
          })
  process.stdout.write(pdf)
}

if (require.main === module)
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
