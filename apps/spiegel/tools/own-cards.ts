// Eigene Scheiben für die Dev-Datenbank (`seed-own.ts`), nie in Produktion: in Produktion kommen Scheiben über die
// Brücke. Die echten Daten liegen nur lokal in `tools/private/own-cards.json` (gitignored, ADR-029), ohne Name,
// Sportpass und ScheibenID; fehlt die Datei, nimmt `seed:own` erfundene Scheiben (`demoCardSeeds`). Weggelassen: ohne
// Scheibenbild (Zimmerstutzen, „LP Schach“) und verdeckt (Anzeigeart 5 oder 10, SF-19). Mit `--demo` kommen erfundene
// Scheiben ohne Brücke in jeder Detailtiefe dazu (`demoEnteredSeeds`), nie an echte Daten.
import { existsSync, readFileSync } from "node:fs"

import {
  classifyCompleteness,
  parseDisciplineId,
  resolveTarget,
  suggestFamily,
  type FamilyId,
} from "@vereinsheim/shot-core/discipline"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS, type TargetId, type Weapon } from "@vereinsheim/shot-core/targets"

import type { CardInput, ShotInput } from "../src/lib/db/cards"
import type { DetailsInput, EnteredOrigin } from "../src/lib/entered/details"
import { generateSeason } from "../test/generate"

export interface OwnSeedShot {
  /** 0 Probe, 1 Wertung */
  stellung: 0 | 1
  nr: number
  serie: number
  /** Lage in µm (Meyton: 1/100 mm) */
  xUm: number
  yUm: number
  /** Abstand zum ersten Schuss der Scheibe in ms */
  offsetMs: number
  /** Meytons Wert in Zehnteln (`Ring01`) */
  decimalTenths: number
  innerTen: boolean
  /** Anzeigeart am Monitor (`Treffer.Wertung`: 1, 7 Zehntel; 2, 8 ganze Ringe; 5 verdeckt) */
  display: number
}

export interface OwnCard {
  /** laufende Nummer, zugleich die erfundene ScheibenID der Dev-Quelle */
  n: number
  disciplineId: number
  /** Name der Disziplin in der Anlage */
  discipline: string
  /** erster Schuss in UTC */
  startedAt: string
  shots: readonly OwnSeedShot[]
}

/** die lokalen eigenen Scheiben, null ohne `tools/private/own-cards.json` */
export function loadOwnCards(
  file = new URL("./private/own-cards.json", import.meta.url)
): readonly OwnCard[] | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as OwnCard[]) : null
}

/** verdeckt am Monitor: bleibt in der Brücke, bis der Admin freigibt (SF-19, SF-74) */
const HIDDEN_DISPLAYS: ReadonlySet<number> = new Set([5, 10])

/**
 * amtliche Wertung nach der Waffe, solange der Adapter sie nicht aus der Disziplin liest: Luftpistole in ganzen Ringen
 * wie am Ausdruck, Luftgewehr unbekannt
 */
const OFFICIAL_BY_WEAPON: Readonly<Partial<Record<Weapon, Scoring>>> = { lp: "rings" }

export type OmittedReason = "ohne Scheibenbild" | "verdeckt"

export interface OwnCardSeed {
  /** laufende Nummer der Scheibe; zugleich die erfundene ScheibenID der Dev-Quelle */
  n: number
  discipline: {
    meytonId: number
    name: string
    targetId: TargetId
    family: FamilyId
    officialScoring: Scoring | null
  }
  card: Omit<CardInput, "sourceId" | "disciplineId" | "ownerId">
  shots: ShotInput[]
}

function seedOf(own: OwnCard): OwnCardSeed | OmittedReason {
  const targetId = resolveTarget({ disciplineId: own.disciplineId, name: own.discipline }).targetId
  if (!targetId) return "ohne Scheibenbild"
  if (own.shots.some((shot) => shot.stellung === 1 && HIDDEN_DISPLAYS.has(shot.display)))
    return "verdeckt"
  const target = TARGETS[targetId]
  const startedAtMs = Date.parse(own.startedAt)
  // Abgabefolge nach der Zeit; bei gleicher Zeit bleibt die Folge der Daten
  const ordered = own.shots
    .map((shot, i) => ({ shot, i }))
    .sort((a, b) => a.shot.offsetMs - b.shot.offsetMs || a.i - b.i)
    .map(({ shot }) => shot)
  const shots: ShotInput[] = ordered.map((shot, i) => {
    const score = scoreFromCoordinates(target, shot.xUm, shot.yUm)
    return {
      seq: i + 1,
      stellung: shot.stellung,
      treffer: shot.nr,
      series: shot.stellung === 0 ? null : shot.serie,
      xUm: shot.xUm,
      yUm: shot.yUm,
      ring: score.ring,
      // amtlich: Meytons Wert (gleich der Wertung aus der Lage, Test)
      decimalTenths: shot.decimalTenths,
      distanceTenthsUm: Math.round(Math.hypot(shot.xUm, shot.yUm) * 10),
      innerTen: shot.innerTen,
      displayMode: shot.display,
      firedAtMs: startedAtMs + shot.offsetMs,
      flags: score.miss ? ["fehlschuss"] : [],
    }
  })
  const match = shots.filter((shot) => shot.stellung !== 0).length
  const completeness = classifyCompleteness({
    sighterShots: shots.length - match,
    matchShots: match,
    plannedShots: parseDisciplineId(own.disciplineId).plannedShots,
  })
  return {
    n: own.n,
    discipline: {
      meytonId: own.disciplineId,
      name: own.discipline,
      targetId,
      family: suggestFamily({ targetId, disciplineId: own.disciplineId, name: own.discipline }),
      officialScoring: OFFICIAL_BY_WEAPON[target.weapon] ?? null,
    },
    card: {
      scheibenId: own.n,
      stand: null,
      startedAtMs,
      endedAtMs: startedAtMs + Math.max(...own.shots.map((shot) => shot.offsetMs)),
      kind: "training",
      state: "final",
      complete: completeness !== "unvollstaendig",
      flags: completeness === "unvollstaendig" ? ["unvollstaendig"] : [],
      origin: "raw",
    },
    shots,
  }
}

/** die Scheiben für die Dev-Datenbank und die weggelassenen mit Grund */
export function ownCardSeeds(cards: readonly OwnCard[]): {
  seeds: OwnCardSeed[]
  omitted: { n: number; reason: OmittedReason }[]
} {
  const seeds: OwnCardSeed[] = []
  const omitted: { n: number; reason: OmittedReason }[] = []
  for (const own of cards) {
    const seed = seedOf(own)
    if (typeof seed === "string") omitted.push({ n: own.n, reason: seed })
    else seeds.push(seed)
  }
  return { seeds, omitted }
}

const LP_40 = { meytonId: 19210040, name: "LP 40", targetId: "lp-10m" } as const

/**
 * erfundene Scheiben, wenn keine eigenen da sind: Luftpistole, drei je Abend über ein halbes Jahr, Training mit Probe,
 * nur Probe und Wettkampf (`test/generate.ts`, fester Seed)
 */
export function demoCardSeeds(): OwnCardSeed[] {
  return generateSeason({
    seed: 2026,
    cards: 72,
    firstMs: Date.UTC(2025, 9, 7, 16, 30),
    everyDays: 7,
    sourceId: 0,
    disciplineId: 0,
    ownerId: "",
    scheibenIdBase: 1,
  }).map(({ card, shots }, i) => {
    const { sourceId: _source, disciplineId: _discipline, ownerId: _owner, ...rest } = card
    return {
      n: i + 1,
      discipline: {
        ...LP_40,
        family: suggestFamily({
          targetId: LP_40.targetId,
          disciplineId: LP_40.meytonId,
          name: LP_40.name,
        }),
        officialScoring: "rings",
      },
      card: rest,
      shots: [...shots],
    }
  })
}

/** eine erfundene Scheibe ohne Brücke für `seed:own --demo`: eine Detailtiefe, wie Scan, Hand und Übernahme sie bringen */
export interface DemoEnteredSeed {
  origin: EnteredOrigin
  startedAtMs: number
  kind: "training" | "competition"
  place: string | null
  /** nur aus Treffsicher: der Schlüssel der Übernahme findet die Scheibe wieder */
  importKey?: string
  /** von Hand ohne Uhrzeit eingetragen */
  timeUnknown?: boolean
  details: DetailsInput
  level: "none" | "series" | "total" | "shots"
}

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

/**
 * Erfundene Scheiben in jeder Detailtiefe (nur mit `--demo`, für die Skriptprüfung): eine vom Ausdruck, die auf die Anlage
 * wartet, kurz vor dem letzten Abend (also auf Start), dazu auf einem eigenen Abend 13 Tage vor der neuesten Scheibe
 * Serien-Summen mit und ohne Zehntel, ein Gesamtergebnis mit Trefferlage aus Treffsicher, eins nur in Zehnteln, Schüsse
 * ohne Zehntel und Schüsse vom Ausdruck ohne Lage und Zeit. Das Gesamtergebnis in Zehnteln ist ohne Uhrzeit eingetragen. Für die Disziplin des Aufrufers (LP 40: 40 Schuss, Serie
 * 10). Die Schüsse kommen aus `generateSeason` (fester Seed), nur die Wertung.
 */
export function demoEnteredSeeds(anchor: {
  newestMs: number
  eveningStartMs: number
}): DemoEnteredSeed[] {
  const generated = generateSeason({
    seed: 2027,
    cards: 12,
    firstMs: anchor.newestMs,
    everyDays: 7,
    sourceId: 0,
    disciplineId: 0,
    ownerId: "",
    scheibenIdBase: 1,
  })
  const match = (
    generated.find((g) => g.shots.filter((s) => s.stellung !== 0).length === 40)?.shots ?? []
  ).filter((shot) => shot.stellung !== 0)
  const evening = anchor.newestMs - 13 * DAY_MS
  const at = (i: number) => evening + i * 10 * MINUTE_MS
  const north = "Vereinsheim Nord"
  return [
    {
      origin: "pdf",
      startedAtMs: anchor.eveningStartMs - 20 * MINUTE_MS,
      kind: "training",
      place: null,
      details: {},
      level: "none",
    },
    {
      origin: "manual",
      startedAtMs: at(0),
      kind: "training",
      place: north,
      details: {
        series: [
          [88, 921],
          [86, 905],
          [90, 934],
          [87, 912],
        ].map(([rings, decimalTenths], i) => ({ series: i + 1, shots: 10, rings, decimalTenths })),
      },
      level: "series",
    },
    {
      origin: "manual",
      startedAtMs: at(1),
      kind: "training",
      place: north,
      details: {
        series: [89, 91, 87, 90].map((rings, i) => ({ series: i + 1, shots: 10, rings })),
      },
      level: "series",
    },
    {
      origin: "treffsicher",
      startedAtMs: at(2),
      kind: "competition",
      place: "Schützenhaus Süd",
      importKey: "treffsicher:demo-total-center",
      details: { total: { rings: 362 }, center: { xUm: 1400, yUm: -900 } },
      level: "total",
    },
    {
      origin: "manual",
      startedAtMs: at(3),
      kind: "training",
      place: north,
      details: { total: { decimalTenths: 3658 } },
      timeUnknown: true,
      level: "total",
    },
    {
      origin: "manual",
      startedAtMs: at(4),
      kind: "training",
      place: north,
      details: {
        shots: match.map((shot) => ({
          series: shot.series,
          ring: shot.ring,
          decimalTenths: null,
          xUm: shot.xUm,
          yUm: shot.yUm,
        })),
      },
      level: "shots",
    },
    {
      origin: "pdf",
      startedAtMs: at(5),
      kind: "training",
      place: null,
      details: {
        shots: match.map((shot) => ({
          series: shot.series,
          ring: shot.ring,
          decimalTenths: shot.decimalTenths,
        })),
      },
      level: "shots",
    },
  ]
}
