import { LINE_Y_TOLERANCE, SERIES_HEADER_REGEX } from "@/lib/sessions/meyton-import/constants"

export interface PdfTextItem {
  str: string
  x: number
  y: number
}

interface TextLine {
  anchorY: number
  items: PdfTextItem[]
}

function groupItemsIntoLines(items: PdfTextItem[]): TextLine[] {
  const lines: TextLine[] = []

  for (const item of items) {
    const current = lines[lines.length - 1]
    // Anker ist die y des ersten Zeilenitems. Ein laufender Mittelwert wuerde ueber
    // die vielen Grafik-Items driften und die naechste Zeile mit verschlucken.
    if (current && Math.abs(current.anchorY - item.y) <= LINE_Y_TOLERANCE) {
      current.items.push(item)
    } else {
      lines.push({ anchorY: item.y, items: [item] })
    }
  }

  return lines
}

/**
 * Rekonstruiert Textzeilen aus positionierten PDF-Textitems.
 *
 * Meyton-PDFs setzen die Nummern der Scheiben-Grafik auf dieselbe Zeilenhoehe wie
 * die Schusswerte. Ohne Spaltenschnitt liest der Serien-Parser sie als Schuesse ein.
 * Als linke Kante der Datenspalte dient die x-Position der "Serie n:"-Beschriftung;
 * sie wird bei jeder neuen Serie nachgezogen.
 */
export function buildTextLinesFromItems(items: PdfTextItem[], columnTolerance = 8): string[] {
  const sorted = items
    .map((item) => ({ ...item, str: item.str.trim() }))
    .filter((item) => item.str.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const result: string[] = []
  let columnX: number | null = null

  for (const line of groupItemsIntoLines(sorted)) {
    line.items.sort((a, b) => a.x - b.x)

    const anchor = line.items.find((item) => SERIES_HEADER_REGEX.test(item.str))
    if (anchor) columnX = anchor.x

    // Lokale Konstante, damit das Narrowing in die Filter-Closure traegt.
    const edge = columnX
    const kept =
      edge === null ? line.items : line.items.filter((item) => item.x >= edge - columnTolerance)

    // Leer gewordene Zeilen ganz weglassen: eine Leerzeile wuerde den Schussblock
    // im Serien-Parser beenden.
    if (kept.length === 0) continue

    result.push(kept.map((item) => item.str).join(" "))
  }

  return result
}
