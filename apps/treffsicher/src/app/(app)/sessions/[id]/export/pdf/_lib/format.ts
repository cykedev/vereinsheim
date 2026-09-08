import { formatDateTime as formatDateTimeShared, formatIsoDate } from "@vereinsheim/lib/format"

export function formatDateTime(date: Date, displayTimeZone: string): string {
  return formatDateTimeShared(new Date(date), displayTimeZone)
}

export function formatDateForFile(date: Date, displayTimeZone: string): string {
  return formatIsoDate(new Date(date), displayTimeZone)
}

export function formatScore(score: number | null, isDecimal: boolean): string {
  if (score === null) return "-"
  if (isDecimal) return score.toFixed(1)
  return String(Math.round(score))
}

export function hasValue(value: string | null | undefined): boolean {
  return value != null && value.trim().length > 0
}
