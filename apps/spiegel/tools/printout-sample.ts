// Schreibt einen erfundenen Meyton-Ausdruck (Qt-Weg, ID ff914420, Druckzeit mit Zeitzone) als PDF nach stdout. Für den
// Stack-Test (`tools/stack-e2e/ops.sh`) und zum Messen des Lesers von Hand; mit `--kind memory|time` eine der
// präparierten Bomben. Kein echter Ausdruck (ADR-029).
//
//   pnpm exec tsx tools/printout-sample.ts | node .next/standalone/apps/spiegel/printout-reader.mjs

import { bombContent, buildPdf } from "@vereinsheim/meyton-pdf/test-pdf"

const INFO = { CreationDate: "D:20261002195212+02'00'", Producer: "Qt 5.12.8" }

function kindOf(argv: readonly string[]): "sample" | "memory" | "time" {
  const index = argv.indexOf("--kind")
  const kind = index === -1 ? "sample" : argv[index + 1]
  if (kind === "sample" || kind === "memory" || kind === "time") return kind
  throw new Error("--kind memory|time")
}

async function main() {
  const kind = kindOf(process.argv.slice(2))
  const pdf =
    kind === "sample"
      ? await buildPdf({
          pages: [
            [
              { str: "LP 40", x: 57, y: 782 },
              { str: "Serie 1: 10,5 10,3 9,8 10,1 9,6 10,0", x: 153, y: 700 },
              { str: "ID: ff914420 - Seite: 1", x: 258, y: 26 },
            ],
          ],
          font: "identity-h",
          info: INFO,
        })
      : await buildPdf({ pages: [[]], rawPages: [bombContent(kind)], info: INFO })
  process.stdout.write(pdf)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
