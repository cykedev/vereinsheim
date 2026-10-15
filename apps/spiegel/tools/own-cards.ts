// Die echten Scheiben des Users (`own-cards-data.ts`, aus der privaten Kopie der Vereinsanlage vom 9. Oktober 2026, mit
// Zustimmung des Users, ohne Name, Sportpass und ScheibenID) als Eingabe für `writeRevision`. Nur für die
// Dev-Datenbank (`seed-own.ts`); in Produktion kommen Scheiben über die Brücke. Weggelassen: ohne Scheibenbild
// (Zimmerstutzen, „LP Schach“) und verdeckt (Anzeigeart 5 oder 10, SF-19).
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
import { OWN_CARDS, type OwnCard } from "./own-cards-data"

/** verdeckt am Monitor: bleibt in der Brücke, bis der Admin freigibt (SF-19, SF-74) */
const HIDDEN_DISPLAYS: ReadonlySet<number> = new Set([5, 10])

/**
 * amtliche Wertung nach der Waffe, solange der Adapter sie nicht aus der Disziplin liest: Luftpistole in ganzen Ringen
 * wie am Ausdruck vom 2. Oktober 2026, Luftgewehr unbekannt
 */
const OFFICIAL_BY_WEAPON: Readonly<Partial<Record<Weapon, Scoring>>> = { lp: "rings" }

export type OmittedReason = "ohne Scheibenbild" | "verdeckt"

export interface OwnCardSeed {
  /** laufende Nummer der Scheibe in `own-cards-data.ts`; zugleich die erfundene ScheibenID der Dev-Quelle */
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
export function ownCardSeeds(cards: readonly OwnCard[] = OWN_CARDS): {
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
