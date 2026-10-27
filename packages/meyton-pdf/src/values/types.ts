// Was ein Meyton-Ausdruck an Werten zeigt, so wie er es zeigt. Jedes Feld ist null, wenn der Ausdruck es nicht trägt
// oder der Leser es nicht erkennt; geraten wird nichts. Zahlen mit einer Nachkommastelle stehen als ganze Zehntel
// (92,7 → 927), Längen in mm wie gedruckt, Lagen im Trefferbild in Koordinaten des PDFs (Punkt, y nach oben).

/** Ringe und Zehntel einer Summe, getrennt; „88 (92.7)“ → { rings: 88, tenths: 927 } */
export interface SumValue {
  rings: number | null
  tenths: number | null
}

/** ein Teiler mit seiner Schussnummer, „171.4 (10.)“ → { value: 171.4, shot: 10 } */
export interface TeilerRef {
  value: number
  shot: number
}

/** Trefferlage in mm, rechts und hoch positiv */
export interface CenterMm {
  x: number
  y: number
}

/** „Streuwert: 10.88, horizontal: 11.90, vertikal: 9.77“ */
export interface SpreadValue {
  overall: number
  horizontal: number | null
  vertical: number | null
}

/** ein Wert je Schuss in Zehnteln (104 = 10,4), mit Stern für den Innenzehner */
export interface ShotValue {
  series: number
  value: number
  innerTen: boolean
  /** Teiler des Schusses, nur in Layouts, die ihn je Schuss drucken („10.0 766T“) */
  teiler: number | null
}

export interface SeriesValues {
  number: number
  sum: SumValue | null
  /** die Werte dieser Serie in der Reihenfolge des Ausdrucks */
  shots: ShotValue[]
  bestTeiler: TeilerRef[] | null
  hitCircleMm: number | null
  centerMm: CenterMm | null
  spread: SpreadValue | null
}

export interface PointPt {
  x: number
  y: number
}

export interface BoxPt {
  left: number
  bottom: number
  right: number
  top: number
}

/** ein gezeichneter Treffer: Mitte des Kreises oder Kreuzes, `index` in der Reihenfolge der Zeichnung (0 = erster) */
export interface DrawnHole extends PointPt {
  index: number
}

/** eine Schussnummer im Trefferbild, Mitte des Textes */
export interface DrawnLabel extends PointPt {
  shot: number
}

/** ein Trefferbild: Scheibe mit Ringen, Treffern und Nummern */
export interface Picture {
  /** Rahmen des Bilds; null, wenn keiner gezeichnet ist */
  frame: BoxPt | null
  /** gemeinsame Mitte der Ringe */
  center: PointPt
  /** Durchmesser der Ringe, absteigend, ohne Doppelte */
  ringDiametersPt: number[]
  /** Größe der Treffer (Kreis im Kaliber oder Kreuz); null ohne Treffer */
  holeDiameterPt: number | null
  holeShape: "circle" | "cross" | null
  holes: DrawnHole[]
  labels: DrawnLabel[]
}

export interface PrintoutValues {
  discipline: string | null
  /** Modus beim Druck, etwa „Probe“, „Wertung“, „Training“ */
  mode: string | null
  result: SumValue | null
  /** Zeile „Serien:“ in ganzen Ringen */
  seriesRings: number[] | null
  /** Zeile „Zähler:“ */
  counts: number[] | null
  innerTens: number | null
  bestTeiler: TeilerRef[] | null
  widestTeiler: TeilerRef[] | null
  hitCircleMm: number | null
  centerMm: CenterMm | null
  spread: SpreadValue | null
  series: SeriesValues[]
  /** alle Werte je Schuss in der Reihenfolge des Ausdrucks */
  shots: ShotValue[]
  /** Trefferbilder in der Reihenfolge der Zeichnung; meist zuerst die ganze Scheibe, dann je Serie eins */
  pictures: Picture[]
  /** die erkannten Beschriftungen, in der Reihenfolge des Ausdrucks */
  layout: string[]
}
