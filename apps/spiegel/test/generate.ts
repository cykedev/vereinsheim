// Erfundene Scheiben für die Tests der Zugriffe und die Messung (tools/measure.ts): fester Seed, Luftpistole, Werte
// aus der Lage über den Fachkern. Mischung wie ein aktiver Schütze: Training mit Probe, Training nur aus Probe,
// Wettkampf; drei Scheiben je Abend, Abende über die Jahre verteilt.

import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { LP_10M } from "@vereinsheim/shot-core/targets"

import type { RevisionInput, ShotInput } from "@/lib/db/cards"

const DAY_MS = 86_400_000

/** Mulberry32: klein, schnell, deterministisch */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

export interface SeasonOptions {
  seed: number
  cards: number
  /** Beginn des ersten Abends (UTC, 18:30 Uhr Ortszeit ungefähr) */
  firstMs: number
  /** Abstand der Abende in Tagen */
  everyDays: number
  sourceId: number
  disciplineId: number
  ownerId: string
  /** ScheibenIDs ab hier, fortlaufend */
  scheibenIdBase: number
}

type Shape = { kind: "training" | "competition"; probe: number; match: number }

function shapeOf(rand: () => number): Shape {
  const r = rand()
  if (r < 0.6) return { kind: "training", probe: 6, match: 30 }
  if (r < 0.85) return { kind: "training", probe: 25, match: 0 }
  return { kind: "competition", probe: 10, match: 40 }
}

/** die Scheiben einer Saison als Revisionen zum Schreiben, in zeitlicher Folge */
export function generateSeason(options: SeasonOptions): RevisionInput[] {
  const rand = random(options.seed)
  const inputs: RevisionInput[] = []
  for (let i = 0; i < options.cards; i++) {
    const evening = Math.floor(i / 3)
    const startedAtMs =
      options.firstMs + evening * options.everyDays * DAY_MS + (i % 3) * 45 * 60_000
    const shape = shapeOf(rand)
    // Form schwankt von Scheibe zu Scheibe, der Mittelpunkt wandert etwas
    const sigma = 3_600 + 900 * gaussian(rand)
    const mx = 800 * gaussian(rand)
    const my = 800 * gaussian(rand)
    const shots: ShotInput[] = []
    let at = startedAtMs + 120_000
    const total = shape.probe + shape.match
    for (let n = 0; n < total; n++) {
      const probe = n < shape.probe
      const xUm = Math.round((mx + Math.abs(sigma) * gaussian(rand)) / 10) * 10
      const yUm = Math.round((my + Math.abs(sigma) * gaussian(rand)) / 10) * 10
      const score = scoreFromCoordinates(LP_10M, xUm, yUm)
      at += 35_000 + Math.round(30_000 * rand()) + (rand() < 0.03 ? 150_000 : 0)
      const treffer = probe ? n + 1 : n - shape.probe + 1
      shots.push({
        seq: n + 1,
        stellung: probe ? 0 : 1,
        treffer,
        series: probe ? null : Math.ceil(treffer / 10),
        xUm,
        yUm,
        ring: score.ring,
        decimalTenths: score.decimalTenths,
        distanceTenthsUm: Math.round(Math.hypot(xUm, yUm) * 10),
        innerTen: score.innerTen,
        displayMode: 1,
        firedAtMs: at,
        flags: score.miss ? ["fehlschuss"] : [],
      })
    }
    const probeOnly = shape.match === 0
    inputs.push({
      card: {
        sourceId: options.sourceId,
        scheibenId: options.scheibenIdBase + i,
        ownerId: options.ownerId,
        disciplineId: options.disciplineId,
        stand: String(1 + (i % 12)),
        startedAtMs,
        endedAtMs: at,
        kind: shape.kind,
        state: "final",
        complete: true,
        official: probeOnly ? null : "rings",
        flags: [],
        origin: "raw",
      },
      shots,
      reason: "ingest",
    })
  }
  return inputs
}
