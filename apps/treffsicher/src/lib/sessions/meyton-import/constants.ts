export const WERTUNG_DATETIME_REGEX = /Wertung\s+(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/i
export const PROBE_DATETIME_REGEX = /Probe\s+(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/i
export const GENERIC_DATETIME_GLOBAL_REGEX = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/g
export const HIT_LOCATION_REGEX =
  /Trefferlage\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*mm\s*(rechts|links)\s*,\s*([0-9]+(?:[.,][0-9]+)?)\s*mm\s*(hoch|tief)/i
export const SERIES_HEADER_REGEX = /Serie\s+(\d+)\s*:/i
export const SERIES_HEADER_GLOBAL_REGEX = /Serie\s+(\d+)\s*:/gi
export const SHOT_TOKEN_REGEX = /(^|[^0-9])(\d{1,2}(?:\.\d)?)(?:\*|T)?(?!\d)/g

// Grenzen gegen praeparierte PDFs. Die frueheren Dekompressions-Caps sind mit
// pdf.js gegenstandslos — stattdessen begrenzen wir Seiten, Textmenge und Laufzeit.
//
// WICHTIG: Alle vier Grenzen muessen *waehrend* des Parsens greifen, nicht danach.
// Eine praeparierte PDF blockiert den Event-Loop komplett — gemessen: bei 2382 ms
// Parsen feuerte weder ein setTimeout(300) noch ein setInterval(1000). Eine
// Zeitgrenze per Timer/Promise.race ist deshalb wirkungslos; sie wird im
// Stream-Loop gegen Date.now() geprueft. Aus demselben Grund wird der Text
// gestreamt statt per getTextContent() am Stueck geholt: sonst materialisiert
// pdf.js die ganze Seite, bevor irgendein Cap greift (gemessen: 3,2-MB-PDF → 665 MB RSS).
export const MAX_PDF_PAGES = 20
export const MAX_EXTRACTED_TEXT_CHARS = 200_000
export const MAX_TEXT_ITEMS = 50_000
export const MAX_PDF_PARSE_MS = 15_000

// Maximaler y-Versatz, bis zu dem zwei Textitems noch als eine Zeile gelten.
export const LINE_Y_TOLERANCE = 3

// Wieviel weiter links als die "Serie n:"-Beschriftung ein Item noch zur
// Datenspalte zaehlt (gemessen: behaltene Items ab x≥153, verworfene bis x≤136).
export const COLUMN_X_TOLERANCE = 8

// Beenden den Schussblock einer Serie. "zaehler" und "zähler" stehen beide drin:
// die PDFs schreiben "Zähler:" mit Umlaut, und diese Zeile besteht ausschliesslich
// aus Werten im gueltigen Schussbereich (18 16 6 0 0 ...) — ohne Treffer liest der
// Parser sie als Schuesse ein. "trefferkreis" gibt es nur im neueren Qt-Format.
export const STOP_KEYWORDS = [
  "trefferlage",
  "trefferkreis",
  "streuwert",
  "ergebnis",
  "serien:",
  "zähler",
  "zaehler",
  "innenzehner",
  "weiteste",
  "teiler",
  "gedruckt am",
  "id:",
  "seite:",
]
