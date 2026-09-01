import {
  COLUMN_X_TOLERANCE,
  LINE_Y_TOLERANCE,
  SERIES_HEADER_REGEX,
} from "@/lib/sessions/meyton-import/constants"

export interface PdfTextItem {
  page: number
  str: string
  x: number
  y: number
}

interface TextLine {
  page: number
  anchorY: number
  items: PdfTextItem[]
}

function groupItemsIntoLines(items: PdfTextItem[]): TextLine[] {
  const lines: TextLine[] = []

  for (const item of items) {
    const current = lines[lines.length - 1]
    // Anker ist die y des ersten Zeilenitems. Ein laufender Mittelwert wuerde ueber
    // die vielen Grafik-Items driften und die naechste Zeile mit verschlucken.
    // Nie ueber Seitengrenzen gruppieren: y-Koordinaten sind seitenlokal und
    // wiederholen sich im selben Report-Template auf jeder Seite exakt.
    if (
      current &&
      current.page === item.page &&
      Math.abs(current.anchorY - item.y) <= LINE_Y_TOLERANCE
    ) {
      current.items.push(item)
    } else {
      lines.push({ page: item.page, anchorY: item.y, items: [item] })
    }
  }

  return lines
}

/**
 * Sucht die linke Kante der Datenspalte in einer Zeile.
 *
 * Bewusst gegen den zusammengesetzten Zeilentext statt gegen einzelne Items:
 * Qt/Identity-H emittiert ein Glyph pro Tj, und pdf.js fasst die nur heuristisch
 * zusammen. Wuerde "Serie 1:" je auf zwei Items aufgeteilt, faende eine
 * Item-weise Suche keinen Anker — der Filter fiele stillschweigend aus und die
 * Grafik-Nummern landeten wieder in den Schusswerten (fail-open).
 */
function findSeriesAnchorX(items: PdfTextItem[]): number | null {
  const startOffsets: number[] = []
  let joined = ""

  for (const item of items) {
    if (joined.length > 0) joined += " "
    startOffsets.push(joined.length)
    joined += item.str
  }

  const match = joined.match(SERIES_HEADER_REGEX)
  if (!match || match.index === undefined) return null

  // Das Item, in dem der Treffer beginnt, definiert die Kante.
  let anchorIndex = 0
  for (let index = 0; index < startOffsets.length; index++) {
    if (startOffsets[index] > match.index) break
    anchorIndex = index
  }

  return items[anchorIndex].x
}

/**
 * Rekonstruiert Textzeilen aus positionierten PDF-Textitems.
 *
 * Meyton-PDFs setzen die Nummern der Scheiben-Grafik auf dieselbe Zeilenhoehe wie
 * die Schusswerte. Ohne Spaltenschnitt liest der Serien-Parser sie als Schuesse ein.
 * Als linke Kante der Datenspalte dient die x-Position der "Serie n:"-Beschriftung;
 * sie wird bei jeder neuen Serie nachgezogen und zu jedem Seitenanfang zurueckgesetzt.
 */
export function buildTextLinesFromItems(items: PdfTextItem[]): string[] {
  const sorted = items
    .map((item) => ({ ...item, str: item.str.trim() }))
    .filter((item) => item.str.length > 0)
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)

  const result: string[] = []
  let columnX: number | null = null
  let currentPage: number | null = null

  for (const line of groupItemsIntoLines(sorted)) {
    if (line.page !== currentPage) {
      currentPage = line.page
      // Spaltenkante gilt nur innerhalb einer Seite.
      columnX = null
    }

    line.items.sort((a, b) => a.x - b.x)

    const anchorX = findSeriesAnchorX(line.items)
    if (anchorX !== null) columnX = anchorX

    // Lokale Konstante, damit das Narrowing in die Filter-Closure traegt.
    const edge = columnX
    const kept =
      edge === null ? line.items : line.items.filter((item) => item.x >= edge - COLUMN_X_TOLERANCE)

    // Leer gewordene Zeilen ganz weglassen: eine Leerzeile wuerde den Schussblock
    // im Serien-Parser beenden.
    if (kept.length === 0) continue

    result.push(kept.map((item) => item.str).join(" "))
  }

  return result
}
