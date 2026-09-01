import { deflateSync } from "node:zlib"

export interface TestPdfTextItem {
  str: string
  x: number
  y: number
}

/**
 * Baut ein minimales, gueltiges PDF mit frei positionierten Textitems — eine
 * Seite je uebergebenem Item-Array.
 *
 * Zur Laufzeit gebaut statt als Datei eingecheckt: die Bomben-Variante waere
 * mehrere MB gross, und der Mehrseiten-Fall existiert in keinem echten
 * Beispiel-PDF. Beide Faelle brauchen echtes pdf.js-Parsing, nicht nur die
 * Layout-Funktion — deshalb ein echtes PDF und kein Item-Array.
 */
export function buildTestPdf(pages: TestPdfTextItem[][]): Buffer {
  const contentStreams = pages.map((items) => {
    const ops = [Buffer.from("BT /F1 8 Tf\n", "latin1")]
    for (const item of items) {
      const escaped = item.str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
      ops.push(
        Buffer.from(
          `1 0 0 1 ${item.x.toFixed(1)} ${item.y.toFixed(1)} Tm (${escaped}) Tj\n`,
          "latin1"
        )
      )
    }
    ops.push(Buffer.from("ET\n", "latin1"))
    return deflateSync(Buffer.concat(ops))
  })

  // Objektnummern: 1 = Catalog, 2 = Pages, 3 = Font, dann je Seite ein Page-
  // und ein Contents-Objekt.
  const firstPageObject = 4
  const pageRefs = pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(" ")

  const bodies: (string | Buffer)[] = [
    "<</Type/Catalog/Pages 2 0 R>>",
    `<</Type/Pages/Kids[${pageRefs}]/Count ${pages.length}>>`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ]

  contentStreams.forEach((compressed, index) => {
    const contentsRef = firstPageObject + index * 2 + 1
    bodies.push(
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R>>>>/Contents ${contentsRef} 0 R>>`
    )
    bodies.push(
      Buffer.concat([
        Buffer.from(`<</Length ${compressed.length}/Filter/FlateDecode>>\nstream\n`, "latin1"),
        compressed,
        Buffer.from("\nendstream", "latin1"),
      ])
    )
  })

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")]
  const offsets: number[] = []
  let position = chunks[0].length

  bodies.forEach((body, index) => {
    const number = index + 1
    const head = Buffer.from(`${number} 0 obj\n`, "latin1")
    const tail = Buffer.from("\nendobj\n", "latin1")
    const middle = typeof body === "string" ? Buffer.from(body, "latin1") : body

    offsets.push(position)
    for (const part of [head, middle, tail]) {
      chunks.push(part)
      position += part.length
    }
  })

  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`
  xref += `trailer\n<</Size ${bodies.length + 1}/Root 1 0 R>>\nstartxref\n${position}\n%%EOF\n`
  chunks.push(Buffer.from(xref, "latin1"))

  return Buffer.concat(chunks)
}

/** Eine Seite mit sehr vielen einzeln positionierten Items (Text-Bombe). */
export function buildTextBombPdf(itemCount: number): Buffer {
  const items: TestPdfTextItem[] = []
  for (let i = 0; i < itemCount; i++) {
    items.push({
      str: "x",
      x: 10 + (i % 500) * 1.1,
      y: 800 - (Math.floor(i / 500) % 700) * 1.1,
    })
  }
  return buildTestPdf([items])
}
