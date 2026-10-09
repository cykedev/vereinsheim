// Erfundene Saison für die Seite eines Zeitraums (Plan L3, D17): Luftgewehr etwa 80 Scheiben vom 6. April bis
// 27. September 2026 mit Formknick im Juni und neuer Munition ab 1. August, Luftpistole etwa 40 Scheiben. Fester
// Seed, Lagen auf 1/100 mm wie bei Meyton, kein echter Ausdruck (ADR-029). Die ganze Saison liegt in der
// Sommerzeit (UTC+2): Uhrzeiten ohne Zeitzonen-Rechnung.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import type { NamedPeriod } from "@vereinsheim/shot-ui/period/calendar"

import { gauss, mulberry32, toMetricShots, type RawShot } from "./samples"

export interface SeasonCard {
  id: string
  family: TargetId
  /** wie in der Ansicht „Scheibe“: „Training vom 12.07.2026“ */
  label: string
  raw: RawShot[]
  card: PeriodCard
}

/** „jetzt“ im Labor: 30. September 2026, 12:00 Uhr MESZ */
export const SEASON_NOW_MS = Date.UTC(2026, 8, 30, 10)
export const SEASON_TIME_ZONE = "Europe/Berlin"

export const NAMED_PERIODS: readonly NamedPeriod[] = [
  { id: "lm", name: "Vorbereitung Landesmeisterschaft", from: "2026-05-01", to: "2026-06-30" },
  { id: "muni", name: "Neue Munition", from: "2026-08-01", to: null },
]

const FIRST_DAY = Date.UTC(2026, 3, 6)
const LAST_DAY = Date.UTC(2026, 8, 27)
const DAY = 86_400_000
/** Sommerzeit: Mitteleuropa ist UTC+2 */
const OFFSET_H = 2

const COMPETITIONS: Readonly<Record<string, readonly string[]>> = {
  "lg-10m": [
    "2026-04-18",
    "2026-05-02",
    "2026-05-23",
    "2026-06-06",
    "2026-06-20",
    "2026-07-04",
    "2026-07-18",
    "2026-08-22",
    "2026-09-05",
    "2026-09-19",
    "2026-09-26",
  ],
  "lp-10m": ["2026-04-25", "2026-05-16", "2026-06-13", "2026-07-11", "2026-08-29", "2026-09-12"],
}
/** Trainingstage (0 Sonntag … 6 Samstag) und wie oft ein Abend ausfällt */
const TRAINING: Readonly<Record<string, { days: readonly number[]; skip: number }>> = {
  "lg-10m": { days: [1, 2, 4, 6], skip: 0.15 },
  "lp-10m": { days: [3, 5], skip: 0.25 },
}
const VACATION = ["2026-08-03", "2026-08-16"]
/** diese Scheibe gibt es nur als Ausdruck (Merkmal `nur-pdf`): sie setzt keinen Rekord */
const PRINTOUT_ONLY = "lg-10m-2026-05-23"

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const german = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

/** Streuung je Richtung in µm: Luftgewehr 1,5 mm, im Juni 1,9 mm, ab August 1,3 mm; Luftpistole 12 mm */
function sigmaUm(family: TargetId, day: string): number {
  if (family === "lp-10m") return 12_000
  if (day >= "2026-08-01") return 1300
  if (day.startsWith("2026-06")) return 1900
  return 1500
}

function makeCard(
  rand: () => number,
  family: TargetId,
  day: string,
  kind: PeriodCard["kind"],
  count: number,
  probeOnly: boolean
): SeasonCard {
  const sigma = sigmaUm(family, day)
  // ein kleiner Versatz je Abend, wie am Stand
  const [mx, my] = [0.3 * sigma * gauss(rand), 0.3 * sigma * gauss(rand)]
  const pace = (family === "lg-10m" ? 45 : 55) * 1000
  const [y, m, d] = day.split("-").map(Number)
  const startedAtMs = Date.UTC(y, m - 1, d, (kind === "competition" ? 10 : 18) - OFFSET_H, 30)
  const at = (k: number) => Math.round((k + sigma * gauss(rand)) / 10) * 10
  const raw: RawShot[] = []
  let t = startedAtMs
  const shoot = (shotKind: RawShot["kind"], n: number) => {
    for (let i = 0; i < n; i++) {
      raw.push({ xUm: at(mx), yUm: at(my), firedAtMs: Math.round(t), kind: shotKind })
      t += pace * Math.exp(0.2 * gauss(rand))
    }
  }
  if (probeOnly) shoot("probe", count)
  else {
    shoot("probe", 6)
    t += 60_000
    shoot("match", count)
  }
  const id = `${family}-${day}`
  return {
    id,
    family,
    label: `${kind === "competition" ? "Wettkampf" : "Training"} vom ${german(day)}`,
    raw,
    card: {
      id,
      startedAtMs,
      kind,
      complete: true,
      ...(id === PRINTOUT_ONLY ? { flags: ["nur-pdf"] } : {}),
      shots: toMetricShots(TARGETS[family], raw),
    },
  }
}

let cached: readonly SeasonCard[] | null = null

/** die Saison, in ihrer Folge; einmal gerechnet */
export function season(): readonly SeasonCard[] {
  if (cached) return cached
  const rand = mulberry32(20261009)
  const cards: SeasonCard[] = []
  for (const family of ["lg-10m", "lp-10m"] as const) {
    let trainings = 0
    for (let ms = FIRST_DAY; ms <= LAST_DAY; ms += DAY) {
      const day = iso(ms)
      const weekday = new Date(ms).getUTCDay()
      if (COMPETITIONS[family].includes(day)) {
        cards.push(makeCard(rand, family, day, "competition", 40, false))
        continue
      }
      if (!TRAINING[family].days.includes(weekday)) continue
      if (day >= VACATION[0] && day <= VACATION[1]) continue
      if (rand() < TRAINING[family].skip) continue
      trainings++
      const count = [20, 30, 40, 60][Math.floor(rand() * 4)]
      // jede achte Trainingsscheibe nur Probe (Umschalten vergessen oder bewusst)
      cards.push(makeCard(rand, family, day, "training", count, trainings % 8 === 0))
    }
  }
  cached = cards.sort((a, b) => a.card.startedAtMs - b.card.startedAtMs || (a.id < b.id ? -1 : 1))
  return cached
}
