// Datum aus den Metadaten eines PDFs: im Info-Dict nach der PDF-Norm (D:YYYYMMDDHHmmSSOHH'mm') und
// als xmp:CreateDate (ISO 8601). Ohne Zeitzone gibt es keinen absoluten Zeitpunkt; dann entscheidet
// der Aufrufer, etwa mit der Zeitzone des Vereins. Ungültige Angaben ergeben keine Zeit statt einer
// falschen.

export interface PdfDate {
  /** Ortszeit wie im PDF: "2026-10-02T19:52:12" */
  local: string
  /** Versatz zu UTC in Minuten (+120 für +02:00); null, wenn das PDF keinen nennt */
  offsetMinutes: number | null
  /** absoluter Zeitpunkt; null ohne Versatz */
  epochMs: number | null
}

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  offsetMinutes: number | null
}

const PDF_DATE =
  /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([Zz+-])(?:(\d{2})'?(?:(\d{2})'?)?)?)?$/
const XMP_DATE =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?)?)?(Z|[+-]\d{2}:\d{2})?$/

/** Versätze reichen von −12:00 bis +14:00. */
const MIN_OFFSET = -12 * 60
const MAX_OFFSET = 14 * 60

const pad = (value: number, width = 2) => String(value).padStart(width, "0")
const number = (digits: string | undefined, fallback: number) =>
  digits === undefined ? fallback : Number(digits)
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

function toPdfDate(parts: DateParts): PdfDate | null {
  const { year, month, day, hour, minute, second, offsetMinutes } = parts
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  if (hour > 23 || minute > 59 || second > 59) return null
  if (offsetMinutes !== null && (offsetMinutes < MIN_OFFSET || offsetMinutes > MAX_OFFSET)) {
    return null
  }
  const local = `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`
  const epochMs =
    offsetMinutes === null
      ? null
      : Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000
  return { local, offsetMinutes, epochMs }
}

/** Versatz aus Vorzeichen, Stunden und Minuten; null ohne Angabe, NaN bei ungültiger */
function offsetFrom(sign: string | undefined, hours?: string, minutes?: string): number | null {
  if (sign === undefined) return null
  if (sign === "Z" || sign === "z") return 0
  if (hours === undefined) return Number.NaN
  const mins = number(minutes, 0)
  if (mins > 59) return Number.NaN
  const total = Number(hours) * 60 + mins
  return sign === "-" ? -total : total
}

export function parsePdfDate(raw: string): PdfDate | null {
  const match = PDF_DATE.exec(raw.trim())
  if (!match) return null
  const offsetMinutes = offsetFrom(match[7], match[8], match[9])
  if (Number.isNaN(offsetMinutes)) return null
  return toPdfDate({
    year: Number(match[1]),
    month: number(match[2], 1),
    day: number(match[3], 1),
    hour: number(match[4], 0),
    minute: number(match[5], 0),
    second: number(match[6], 0),
    offsetMinutes,
  })
}

export function parseXmpDate(raw: string): PdfDate | null {
  const match = XMP_DATE.exec(raw.trim())
  if (!match) return null
  const zone = match[7]
  const offsetMinutes =
    zone === undefined
      ? null
      : offsetFrom(zone === "Z" ? "Z" : zone[0], zone.slice(1, 3), zone.slice(4, 6))
  if (Number.isNaN(offsetMinutes)) return null
  return toPdfDate({
    year: Number(match[1]),
    month: number(match[2], 1),
    day: number(match[3], 1),
    hour: number(match[4], 0),
    minute: number(match[5], 0),
    second: number(match[6], 0),
    offsetMinutes,
  })
}
