// Formular „Ergebnis eintragen“ ohne React und ohne Datenbank ([[adr-033]]): der Zustand der Felder, aus ihm die Angaben
// für `checkDetails`/`writeEnteredCard`, aus gespeicherten Angaben wieder der Zustand, und die Texte zu jedem Problem.
// Ring und Zehntel getrennt: In Zehnteln eingetragen ist ein Wert Zehntel, in ganzen Ringen ein Ring; nie umgerechnet.

import { zonedWallTimeMs } from "@vereinsheim/lib/format"
import { MAX_DECIMAL_TENTHS } from "@vereinsheim/shot-core/targets"

import { PLACE_MAX, type DetailsInput, type DetailsProblem, type EnteredShot } from "./details"

export type ValueMode = "decimal" | "rings"
export type ResultMode = "series" | "total"

export interface SeriesRow {
  /** Summe der Serie, wie getippt; aufgeklappt aus den Schüssen gerechnet */
  sum: string
  /** „Schüsse einzeln“ aufgeklappt */
  open: boolean
  shots: string[]
}

export interface CenterFields {
  x: string
  xDir: "left" | "right"
  y: string
  yDir: "up" | "down"
}

export interface EnteredFormState {
  /** `YYYY-MM-DD` in der Anzeige-Zone */
  day: string
  /** `HH:MM` oder leer: Uhrzeit unbekannt */
  time: string
  place: string
  values: ValueMode
  result: ResultMode
  series: SeriesRow[]
  total: string
  /** leer: die Schusszahl der Disziplin */
  totalShots: string
  center: CenterFields
}

/** was das Formular von der Disziplin braucht, schon aufgelöst (`plannedShotsOf`, `seriesShotsOf`) */
export interface FormDiscipline {
  /** Wertungsschüsse; null ohne feste Zahl */
  plannedShots: number | null
  /** Schüsse je Serie; null ohne Serien */
  seriesShots: number | null
  officialScoring: "decimal" | "rings" | null
}

/** Felder mit Fehler: `day`, `time`, `place`, `result`, `series.<i>.sum`, `series.<i>.shot.<j>`, `total`,
 * `totalShots`, `center.x`, `center.y` */
export type FormErrors = Record<string, string>

export const TEXTS = {
  decimal: "Gib den Wert mit höchstens einer Stelle nach dem Komma ein, etwa 10,4.",
  rings: "Gib ganze Ringe ein, etwa 97. Für Zehntel oben „Zehnteln“ wählen.",
  shotMax: "Ein Schuss hat höchstens 10,9.",
  sumMax: (shots: number) => `So viel geht mit ${shots} Schuss nicht.`,
  gap: (series: number) => `Trag Serie ${series} ein oder lass die Serien danach leer.`,
  mixed: "Trag die Schüsse in jeder Serie einzeln ein, oder in keiner.",
  noResult: "Trag mindestens eine Serie oder das Ergebnis ein.",
  shotsUnknown: "Wie viele Schüsse waren es?",
  centerMax: "Die Trefferlage liegt höchstens 100 mm neben der Mitte.",
  centerFormat: "Gib die Trefferlage in mm ein, etwa 1,2.",
  centerWithoutResult: "Die Trefferlage braucht ein Ergebnis.",
  dayFuture: "Der Tag liegt in der Zukunft.",
  dayMissing: "Wähle einen Tag.",
  time: "Gib die Uhrzeit wie 19:30 ein oder lass sie leer.",
  place: `Der Ort hat höchstens ${PLACE_MAX} Zeichen.`,
  notEditable:
    "Diese Scheibe kommt von der Anlage oder vom Ausdruck. Ihre Werte ändert Spiegel nicht.",
  reload: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
} as const

/** so weit von der Mitte liegt keine Trefferlage (100 mm), wie in `checkDetails` */
const CENTER_MAX_UM = 100_000
const MAX_SHOTS = 1000
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

type Value = { rings: number | null; decimalTenths: number | null }
type Parsed = { ok: true; value: Value | null } | { ok: false; error: string }

/**
 * Ein Wert, wie getippt: leer ist keiner. In Zehnteln mit Komma oder Punkt und höchstens einer Stelle danach („97“ ist
 * 97,0), in ganzen Ringen nur ganze Zahlen. `shots`: so viele Schüsse trägt der Wert (1 für einen Schuss).
 */
export function parseValue(text: string, mode: ValueMode, shots: number): Parsed {
  const raw = text.trim()
  if (!raw) return { ok: true, value: null }
  const tooMuch = { ok: false as const, error: shots === 1 ? TEXTS.shotMax : TEXTS.sumMax(shots) }
  if (mode === "rings") {
    if (!/^\d{1,5}$/.test(raw)) return { ok: false, error: TEXTS.rings }
    const rings = Number(raw)
    return rings > 10 * shots ? tooMuch : { ok: true, value: { rings, decimalTenths: null } }
  }
  const match = /^(\d{1,5})(?:[.,](\d))?$/.exec(raw)
  if (!match) return { ok: false, error: TEXTS.decimal }
  const decimalTenths = Number(match[1]) * 10 + Number(match[2] ?? 0)
  return decimalTenths > MAX_DECIMAL_TENTHS * shots
    ? tooMuch
    : { ok: true, value: { rings: null, decimalTenths } }
}

/** ein Wert als Text des Felds: Zehntel mit Komma („10,4“), Ringe ganz; ohne Wert leer */
export function valueText(value: Value, mode: ValueMode): string {
  if (mode === "decimal" && value.decimalTenths !== null)
    return `${Math.floor(value.decimalTenths / 10)},${value.decimalTenths % 10}`
  if (value.rings !== null) return String(value.rings)
  return ""
}

const sumOf = (values: Value[], mode: ValueMode): Value => {
  const key = mode === "decimal" ? "decimalTenths" : "rings"
  const total = values.reduce((sum, value) => sum + (value[key] ?? 0), 0)
  return mode === "decimal"
    ? { rings: null, decimalTenths: total }
    : { rings: total, decimalTenths: null }
}

/** Summe einer aufgeklappten Serie aus ihren Schüssen, als Text; null, solange ein Schuss nicht lesbar ist */
export function seriesSumText(row: SeriesRow, mode: ValueMode): string | null {
  const values: Value[] = []
  for (const shot of row.shots) {
    const parsed = parseValue(shot, mode, 1)
    if (!parsed.ok) return null
    if (parsed.value) values.push(parsed.value)
  }
  return values.length ? valueText(sumOf(values, mode), mode) : ""
}

const filled = (row: SeriesRow) =>
  row.open ? row.shots.some((shot) => shot.trim()) : row.sum.trim() !== ""

/** so viele Serien zeigt das Formular am Anfang: die Schusszahl in Serien, ohne feste Schusszahl eine */
export function defaultSeriesCount(discipline: FormDiscipline): number {
  const { plannedShots, seriesShots } = discipline
  if (!seriesShots) return 0
  return plannedShots ? Math.ceil(plannedShots / seriesShots) : 1
}

export const emptyRow = (discipline: FormDiscipline): SeriesRow => ({
  sum: "",
  open: false,
  shots: Array.from({ length: discipline.seriesShots ?? 0 }, () => ""),
})

/** ein leeres Formular: heute, Werte wie die Wertung der Disziplin, Serien, wenn die Disziplin welche hat */
export function emptyForm(discipline: FormDiscipline, today: string): EnteredFormState {
  return {
    day: today,
    time: "",
    place: "",
    values: discipline.officialScoring === "rings" ? "rings" : "decimal",
    result: discipline.seriesShots ? "series" : "total",
    series: Array.from({ length: defaultSeriesCount(discipline) }, () => emptyRow(discipline)),
    total: "",
    totalShots: "",
    center: { x: "", xDir: "right", y: "", yDir: "up" },
  }
}

function parseMm(text: string): { ok: true; um: number | null } | { ok: false; error: string } {
  const raw = text.trim()
  if (!raw) return { ok: true, um: null }
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(raw)
  if (!match) return { ok: false, error: TEXTS.centerFormat }
  const um = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"))
  return um > CENTER_MAX_UM ? { ok: false, error: TEXTS.centerMax } : { ok: true, um }
}

/** Trefferlage aus den Feldern: rechts und hoch positiv (wie `xUm`/`yUm`); beide leer: keine */
function centerOf(center: CenterFields, errors: FormErrors): DetailsInput["center"] {
  const x = parseMm(center.x)
  const y = parseMm(center.y)
  if (!x.ok) errors["center.x"] = x.error
  if (!y.ok) errors["center.y"] = y.error
  if (!x.ok || !y.ok || (x.um === null && y.um === null)) return null
  // ohne Betrag 0, nie −0
  const signed = (um: number | null, negative: boolean) => (um ? (negative ? -um : um) : 0)
  return {
    xUm: signed(x.um, center.xDir === "left"),
    yUm: signed(y.um, center.yDir === "down"),
  }
}

/**
 * Die Angaben aus dem Formular, oder die Fehler je Feld. Serien: leere am Ende zählen nicht (eine abgebrochene
 * Scheibe), eine leere zwischen gefüllten ist ein Fehler. Aufgeklappt zählen die Schüsse, die Summe kommt aus ihnen;
 * Schüsse einzeln in allen gefüllten Serien oder in keiner (`checkDetails`). Ohne Serien das Gesamtergebnis mit
 * Schusszahl (leer: die der Disziplin).
 */
export function formToDetails(
  form: EnteredFormState,
  discipline: FormDiscipline
): { ok: true; details: DetailsInput } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {}
  const mode = form.values
  const details: {
    shots: EnteredShot[]
    series: { series: number; shots?: number; rings: number | null; decimalTenths: number | null }[]
  } = {
    shots: [],
    series: [],
  }
  let total: DetailsInput["total"] = null

  if (form.result === "series") {
    let last = form.series.length - 1
    while (last >= 0 && !filled(form.series[last]!)) last--
    const rows = form.series.slice(0, last + 1)
    const withShots = rows.some((row) => row.open && filled(row))
    rows.forEach((row, i) => {
      const number = i + 1
      if (!filled(row)) {
        errors[`series.${i}.sum`] = TEXTS.gap(number)
        return
      }
      if (withShots && !row.open) {
        errors[`series.${i}.sum`] = TEXTS.mixed
        return
      }
      if (!row.open) {
        const parsed = parseValue(row.sum, mode, discipline.seriesShots ?? 1)
        if (!parsed.ok) errors[`series.${i}.sum`] = parsed.error
        else if (parsed.value) details.series.push({ series: number, ...parsed.value })
        return
      }
      const values: Value[] = []
      row.shots.forEach((text, j) => {
        const parsed = parseValue(text, mode, 1)
        if (!parsed.ok) errors[`series.${i}.shot.${j}`] = parsed.error
        else if (parsed.value) values.push(parsed.value)
      })
      if (values.length > MAX_SHOTS) errors[`series.${i}.sum`] = TEXTS.reload
      for (const value of values)
        details.shots.push({
          series: number,
          ring: value.rings,
          decimalTenths: value.decimalTenths,
        })
      details.series.push({ series: number, shots: values.length, ...sumOf(values, mode) })
    })
    if (!rows.length) errors.result = TEXTS.noResult
  } else {
    const typed = form.totalShots.trim()
    const shots = typed ? Number(typed) : discipline.plannedShots
    if (typed && !(/^\d{1,4}$/.test(typed) && shots! >= 1 && shots! <= MAX_SHOTS))
      errors.totalShots = TEXTS.shotsUnknown
    else if (shots === null) errors.totalShots = TEXTS.shotsUnknown
    else {
      const parsed = parseValue(form.total, mode, shots)
      if (!parsed.ok) errors.total = parsed.error
      else if (!parsed.value) errors.total = TEXTS.noResult
      else total = { ...parsed.value, ...(typed ? { shots } : {}) }
    }
  }

  const center = centerOf(form.center, errors)
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    details: {
      ...(details.shots.length ? { shots: details.shots } : {}),
      ...(details.series.length ? { series: details.series } : {}),
      ...(total ? { total } : {}),
      ...(center ? { center } : {}),
    },
  }
}

/** gespeicherte Angaben der aktuellen Revision, wie die Seite zum Ändern sie liest */
export interface StoredDetails {
  shots: readonly {
    series: number | null
    ring: number | null
    decimalTenths: number | null
    /** Probe (`stellung` 0) */
    probe: boolean
    /** trägt mehr als den Wert: Lage, Zeit, Innenzehner */
    more: boolean
  }[]
  series: readonly {
    series: number
    shots: number
    rings: number | null
    decimalTenths: number | null
  }[]
  total: { shots: number; rings: number | null; decimalTenths: number | null } | null
  center: { xUm: number; yUm: number } | null
}

/**
 * Der Zustand des Formulars aus gespeicherten Angaben, unverändert gespeichert dieselben Angaben. Null, wenn das
 * Formular sie nicht ganz zeigen kann (Probe, Lage, Zeit oder Innenzehner an Schüssen, Schüsse ohne Serie neben
 * Serien): Ändern ginge dann mit Verlust.
 */
export function detailsToForm(
  stored: StoredDetails,
  discipline: FormDiscipline,
  when: { day: string; time: string; place: string }
): EnteredFormState | null {
  if (stored.shots.some((shot) => shot.probe || shot.more || shot.series === null)) return null
  const shots = stored.shots.map((shot) => ({
    series: shot.series!,
    rings: shot.ring,
    decimalTenths: shot.decimalTenths,
  }))
  const values: Value[] = [...shots, ...stored.series, ...(stored.total ? [stored.total] : [])]
  const mode: ValueMode =
    values.length && values.every((v) => v.decimalTenths !== null)
      ? "decimal"
      : values.length
        ? "rings"
        : discipline.officialScoring === "rings"
          ? "rings"
          : "decimal"
  if (values.some((v) => (mode === "decimal" ? v.decimalTenths : v.rings) === null)) return null

  const base = emptyForm(discipline, when.day)
  const center: CenterFields = stored.center
    ? {
        x: stored.center.xUm ? mmText(Math.abs(stored.center.xUm)) : "",
        xDir: stored.center.xUm < 0 ? "left" : "right",
        y: stored.center.yUm ? mmText(Math.abs(stored.center.yUm)) : "",
        yDir: stored.center.yUm < 0 ? "down" : "up",
      }
    : base.center
  const state = { ...base, time: when.time, place: when.place, values: mode, center }

  const numbers = [
    ...new Set([...stored.series.map((s) => s.series), ...shots.map((s) => s.series)]),
  ].sort((a, b) => a - b)
  if (numbers.length) {
    const count = Math.max(numbers[numbers.length - 1]!, defaultSeriesCount(discipline))
    const series = Array.from({ length: count }, (_, i): SeriesRow => {
      const own = shots.filter((shot) => shot.series === i + 1)
      const sum = stored.series.find((s) => s.series === i + 1)
      if (own.length)
        return {
          sum: "",
          open: true,
          shots: [
            ...own.map((shot) => valueText(shot, mode)),
            ...Array.from(
              { length: Math.max(0, (discipline.seriesShots ?? 0) - own.length) },
              () => ""
            ),
          ],
        }
      return { ...emptyRow(discipline), sum: sum ? valueText(sum, mode) : "" }
    })
    // eine Lücke in den gespeicherten Serien zeigt das Formular nicht
    if (numbers.some((n, i) => n !== i + 1)) return null
    return { ...state, result: "series", series }
  }
  if (stored.total)
    return {
      ...state,
      result: "total",
      total: valueText(stored.total, mode),
      totalShots: stored.total.shots === discipline.plannedShots ? "" : String(stored.total.shots),
    }
  return state
}

/** µm als mm-Text mit Komma, höchstens zwei Stellen */
function mmText(um: number): string {
  const hundredths = Math.round(um / 10)
  const whole = Math.floor(hundredths / 100)
  const rest = hundredths % 100
  if (!rest) return String(whole)
  return `${whole},${String(rest).padStart(2, "0").replace(/0$/, "")}`
}

/** Beginn der Scheibe aus Tag und Uhrzeit in der Zone; ohne Uhrzeit 12 Uhr und `timeUnknown` */
export function startedAtOf(
  day: string,
  time: string,
  timeZone: string,
  today: string
): { ok: true; startedAtMs: number; timeUnknown: boolean } | { ok: false; errors: FormErrors } {
  if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)))
    return { ok: false, errors: { day: TEXTS.dayMissing } }
  if (day > today) return { ok: false, errors: { day: TEXTS.dayFuture } }
  const clock = time.trim()
  if (clock && !TIME.test(clock)) return { ok: false, errors: { time: TEXTS.time } }
  const wall = Date.parse(`${day}T${clock || "12:00"}:00Z`)
  return { ok: true, startedAtMs: zonedWallTimeMs(wall, timeZone), timeUnknown: !clock }
}

/** Feld und Text zu jedem Problem aus `checkDetails`; was das Formular selbst verhindert, heißt „neu laden“ */
export function problemText(problem: DetailsProblem): { field: string | null; text: string } {
  switch (problem) {
    case "shotValue":
    case "shotRingTenths":
      return { field: "result", text: TEXTS.shotMax }
    case "shotSeries":
    case "seriesShots":
      return { field: "result", text: TEXTS.mixed }
    case "seriesShotsUnknown":
    case "totalShotsUnknown":
      return { field: "totalShots", text: TEXTS.shotsUnknown }
    case "centerWithoutResult":
      return { field: "center.x", text: TEXTS.centerWithoutResult }
    case "centerValue":
      return { field: "center.x", text: TEXTS.centerMax }
    case "place":
      return { field: "place", text: TEXTS.place }
    case "startedAt":
      return { field: "day", text: TEXTS.dayMissing }
    case "seriesNumber":
    case "seriesValue":
    case "seriesSum":
    case "totalValue":
    case "totalMismatch":
    case "shotInnerTen":
    case "shotPosition":
    case "shotTime":
    case "importKey":
    case "stand":
      return { field: null, text: TEXTS.reload }
  }
}
