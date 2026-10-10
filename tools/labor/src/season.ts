// Saison des Labors (Plan L3, D17; `plans/2026-10-10-labor-echte-scheiben.md`): Die Luftpistole sind die echten Scheiben
// des Users aus der Vereinsanlage (`ownCards.ts`, mit Zustimmung des Users, Oktober 2024 bis 9. Oktober 2026), dazu die
// zwei Scheiben Luftgewehr. Das übrige Luftgewehr ist erfunden: etwa 80 Scheiben vom 6. April bis 27. September 2026 mit
// Formknick im Juni und neuer Munition ab 1. August, fester Seed, Lagen auf 1/100 mm wie bei Meyton. Das erfundene
// Luftgewehr liegt ganz in der Sommerzeit (UTC+2) und kommt ohne Zeitzonen-Rechnung aus; die echten Scheiben tragen
// ihre Zeit in UTC.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import {
  classifyCompleteness,
  parseDisciplineId,
  resolveTarget,
  suggestFamily,
  type FamilyId,
} from "@vereinsheim/shot-core/discipline"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { eveningDay } from "@vereinsheim/shot-ui/list/evenings"
import type { NamedPeriod } from "@vereinsheim/shot-ui/period/calendar"

import { OWN_CARDS, type OwnCard } from "./ownCards"
import { gauss, mulberry32, toMetricShots, type RawShot } from "./samples"

export interface SeasonCard {
  /** erzeugt wie eine Id aus der Datenbank, nicht aus Datum oder Namen (User, 9. Oktober 2026) */
  id: string
  /** Disziplin-Familie wie im Fachkern; die Saison kennt nur Freihand */
  family: FamilyId
  target: TargetId
  /** wie in der Ansicht „Scheibe“: „Training vom 12.07.2026“ */
  label: string
  raw: RawShot[]
  card: PeriodCard
  /** die Nummer einer echten Scheibe des Users (`OwnCard.n`); fehlt bei erfundenen */
  own?: number
}

/** „jetzt“ im Labor: 10. Oktober 2026, 12:00 Uhr MESZ, der Tag nach dem letzten echten Abend */
export const SEASON_NOW_MS = Date.UTC(2026, 9, 10, 10)
export const SEASON_TIME_ZONE = "Europe/Berlin"

/** benannte Zeiträume mit erzeugter Id, nie aus dem Namen abgeleitet (Review N1) */
export const NAMED_PERIODS: readonly NamedPeriod[] = [
  {
    id: "p4k8w2m1",
    name: "Vorbereitung Landesmeisterschaft",
    from: "2026-05-01",
    to: "2026-06-30",
  },
  { id: "p9q3x7d5", name: "Neue Munition", from: "2026-08-01", to: null },
]

/** die Familie einer Scheibe der Saison: nur Freihand */
const FAMILY_OF: Readonly<Record<TargetId, FamilyId>> = {
  "lg-10m": "lg-freihand",
  "lp-10m": "lp-freihand",
}

/** die Familien der Saison wie im Fachkern, mit Namen; Auflage gibt es in ihr nicht */
export const FAMILIES: readonly { value: FamilyId; label: string }[] = [
  { value: "lg-freihand", label: "Luftgewehr" },
  { value: "lp-freihand", label: "Luftpistole" },
]

/** die Scheibe zu einer Familie, für das Zeichnen; Luftpistole bei `lp-*`, sonst Luftgewehr */
export const targetOfFamily = (family: string): TargetId =>
  family.startsWith("lp-") ? "lp-10m" : "lg-10m"

/**
 * eine Id wie aus der Datenbank: fest aus Scheibe, Tag und Platz am Abend (FNV-1a), aber ohne das lesbar zu zeigen;
 * Platz 0 ergibt die Id von vor N2
 */
function cardId(target: TargetId, day: string, slot = 0): string {
  let hash = 0x811c9dc5
  for (const char of slot ? `${target}/${day}/${slot}` : `${target}/${day}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `c${hash.toString(36).padStart(7, "0")}`
}

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
}
/** Trainingstage (0 Sonntag … 6 Samstag) und wie oft ein Abend ausfällt */
const TRAINING: Readonly<Record<string, { days: readonly number[]; skip: number }>> = {
  "lg-10m": { days: [1, 2, 4, 6], skip: 0.15 },
}
const VACATION = ["2026-08-03", "2026-08-16"]
/** diese Scheibe gibt es nur als Ausdruck (Merkmal `nur-pdf`): sie setzt keinen Rekord */
/** die Scheibe nur aus dem Ausdruck: Luftgewehr am 23. Mai */
export const PRINTOUT_ONLY_ID = cardId("lg-10m", "2026-05-23")

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const german = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`

/** Streuung je Richtung in µm, nur Luftgewehr: 1,5 mm, im Juni 1,9 mm, ab August 1,3 mm */
function sigmaUm(day: string): number {
  if (day >= "2026-08-01") return 1300
  if (day.startsWith("2026-06")) return 1900
  return 1500
}

function makeCard(
  rand: () => number,
  target: TargetId,
  day: string,
  kind: PeriodCard["kind"],
  count: number,
  probeOnly: boolean,
  /** weitere Scheibe am Abend: Platz und Beginn in Ortszeit (Plan N2, D9) */
  extra: { slot: number; hour: number; minute: number } | null = null
): SeasonCard {
  const sigma = sigmaUm(day)
  // ein kleiner Versatz je Abend, wie am Stand
  const [mx, my] = [0.3 * sigma * gauss(rand), 0.3 * sigma * gauss(rand)]
  const pace = (target === "lg-10m" ? 45 : 55) * 1000
  const [y, m, d] = day.split("-").map(Number)
  const startedAtMs = extra
    ? Date.UTC(y, m - 1, d, extra.hour - OFFSET_H, extra.minute)
    : Date.UTC(y, m - 1, d, (kind === "competition" ? 10 : 18) - OFFSET_H, 30)
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
  const id = cardId(target, day, extra?.slot ?? 0)
  return {
    id,
    family: FAMILY_OF[target],
    target,
    label: `${kind === "competition" ? "Wettkampf" : "Training"} vom ${german(day)}`,
    raw,
    card: {
      id,
      startedAtMs,
      kind,
      complete: true,
      ...(id === PRINTOUT_ONLY_ID ? { flags: ["nur-pdf"] } : {}),
      // amtliche Wertung wie am Stand: Rundenwettkämpfe in ganzen Ringen, Training in Zehnteln; nur Probe hat keine
      // (die Saison zieht dafür keinen Zufall, alles andere bleibt gleich)
      ...(probeOnly ? {} : { official: kind === "competition" ? "rings" : "decimal" }),
      shots: toMetricShots(TARGETS[target], raw),
    },
  }
}

/** Anzeigeart der Wertungsschüsse (`Treffer.Wertung`) → amtliche Wertung, wie `PeriodCard.official` sie beschreibt */
const OFFICIAL_BY_DISPLAY: Readonly<Record<number, Scoring>> = {
  1: "decimal",
  7: "decimal",
  2: "rings",
  8: "rings",
}
/** komplett verdeckt (Königsschießen): bleibt in der Brücke, bis der Admin sie freigibt (SF-19) */
const HIDDEN_DISPLAY = 5

/** warum eine echte Scheibe nicht im Labor steht; null, wenn sie dabei ist */
export function ownCardOmitted(own: OwnCard): "ohne Scheibenbild" | "verdeckt" | null {
  if (!resolveTarget({ disciplineId: own.disciplineId, name: own.discipline }).targetId)
    return "ohne Scheibenbild"
  if (own.shots.some((shot) => shot.stellung === 1 && shot.display === HIDDEN_DISPLAY))
    return "verdeckt"
  return null
}

/**
 * die echten Scheiben des Users als Scheiben der Saison: Scheibenbild und Familie aus dem Fachkern (über den Namen der
 * Disziplin), alle Training (in der Anlage „Direktbelegung“ ohne Status), amtliche Wertung aus der Anzeigeart, wenn
 * alle Wertungsschüsse sie teilen, unvollständig mit Merkmal (SF-07)
 */
function ownSeasonCards(): SeasonCard[] {
  const slots = new Map<string, number>()
  return OWN_CARDS.flatMap((own) => {
    if (ownCardOmitted(own)) return []
    const target = resolveTarget({ disciplineId: own.disciplineId, name: own.discipline }).targetId!
    const family = suggestFamily({
      targetId: target,
      disciplineId: own.disciplineId,
      name: own.discipline,
    })
    const startedAtMs = Date.parse(own.startedAt)
    const day = eveningDay(startedAtMs, SEASON_TIME_ZONE)
    const slot = slots.get(`${target}/${day}`) ?? 0
    slots.set(`${target}/${day}`, slot + 1)
    const id = cardId(target, day, slot)
    const raw: RawShot[] = own.shots.map((shot) => ({
      xUm: shot.xUm,
      yUm: shot.yUm,
      firedAtMs: startedAtMs + shot.offsetMs,
      kind: shot.stellung === 1 ? "match" : "probe",
    }))
    const match = own.shots.filter((shot) => shot.stellung === 1)
    const displays = new Set<Scoring | undefined>(
      match.map((shot) => OFFICIAL_BY_DISPLAY[shot.display])
    )
    const official = displays.size === 1 ? [...displays][0] : undefined
    const completeness = classifyCompleteness({
      sighterShots: own.shots.length - match.length,
      matchShots: match.length,
      plannedShots: parseDisciplineId(own.disciplineId).plannedShots,
    })
    return [
      {
        id,
        family,
        target,
        label: `Training vom ${german(day)}`,
        raw,
        own: own.n,
        card: {
          id,
          startedAtMs,
          kind: "training",
          complete: completeness !== "unvollstaendig",
          ...(completeness === "unvollstaendig" ? { flags: ["unvollstaendig"] } : {}),
          ...(official ? { official } : {}),
          shots: toMetricShots(TARGETS[target], raw),
        },
      },
    ]
  })
}

let cached: readonly SeasonCard[] | null = null

/** die Saison, in ihrer Folge; einmal gerechnet */
export function season(): readonly SeasonCard[] {
  if (cached) return cached
  const rand = mulberry32(20261009)
  const cards: SeasonCard[] = []
  const target = "lg-10m"
  let trainings = 0
  for (let ms = FIRST_DAY; ms <= LAST_DAY; ms += DAY) {
    const day = iso(ms)
    const weekday = new Date(ms).getUTCDay()
    if (COMPETITIONS[target].includes(day)) {
      cards.push(makeCard(rand, target, day, "competition", 40, false))
      continue
    }
    if (!TRAINING[target].days.includes(weekday)) continue
    if (day >= VACATION[0] && day <= VACATION[1]) continue
    if (rand() < TRAINING[target].skip) continue
    trainings++
    const count = [20, 30, 40, 60][Math.floor(rand() * 4)]
    // jede achte Trainingsscheibe nur Probe (Umschalten vergessen oder bewusst)
    cards.push(makeCard(rand, target, day, "training", count, trainings % 8 === 0))
  }
  const own = ownSeasonCards()
  cards.push(...own)
  // der letzte Abend als Mischabend (Review N5): zwei erfundene Scheiben Luftgewehr am Abend der neuesten echten
  // Scheibe, damit Start zwei Blöcke, Kacheln nebeneinander und Blättern über beide Familien zeigt; mit eigenem
  // Zufall, damit das Luftgewehr davor gleich bleibt. Der Abend liegt noch in der Sommerzeit (bis 25. Oktober).
  const extra = mulberry32(20261010)
  const lastDay = eveningDay(Math.max(...own.map((c) => c.card.startedAtMs)), SEASON_TIME_ZONE)
  for (const [slot, hour, minute] of [
    [0, 20, 0],
    [1, 20, 45],
  ] as const) {
    cards.push(makeCard(extra, "lg-10m", lastDay, "training", 20, false, { slot, hour, minute }))
  }

  // bei gleicher Zeit Luftgewehr vor Luftpistole, wie vor den erzeugten Ids
  cached = cards.sort(
    (a, b) => a.card.startedAtMs - b.card.startedAtMs || (a.target < b.target ? -1 : 1)
  )
  return cached
}
