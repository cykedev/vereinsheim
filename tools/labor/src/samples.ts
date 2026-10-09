// Beispielscheiben des Labors, wie in der Spielwiese (tools/spielwiese/template.html, „sampleForty“):
// erfunden, mit festem Seed, Lagen auf 1/100 mm wie bei Meyton. Der Ausdruck vom 2. Oktober steht als
// Teiler ohne Namen auch in den Fixtures von shot-core.

import type { MetricShot, Scoring } from "@vereinsheim/shot-core/metrics"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import type { TargetId, TargetImage } from "@vereinsheim/shot-core/targets"

export interface RawShot {
  xUm: number
  yUm: number
  firedAtMs: number
  kind: "probe" | "match"
}

export type SampleId = "forty" | "training" | "printout" | "series" | "pair" | "empty"

export interface Sample {
  id: SampleId
  label: string
  hint: string
  /** amtliche Wertung, wenn das Beispiel eine hat (erfunden; beim Ausdruck unbekannt) */
  official?: Scoring
}

const FORTY: Sample = {
  id: "forty",
  label: "40 Schuss mit Probe",
  hint: "Erfundene Scheibe: neun Probeschüsse (die ersten vier weit daneben), 40 Wertungsschüsse, nach Schuss 20 eine Pause; bei der Luftpistole senkrecht gestreckt und mit einem Abreißer (Schuss 27). Als amtliche Wertung angenommen: Zehntel.",
  official: "decimal",
}

const TRAINING: Sample = {
  id: "training",
  label: "60 Probe",
  hint: "Erfundenes Training nur mit Probe: 60 Probeschüsse, nach Schuss 30 eine Pause. Ohne Wertung zeigt Spiegel die Probe wie Wertung, in Serien zu zehn; setzt du eine Wertung dazu, trennt es wieder.",
}

const EMPTY: Sample = {
  id: "empty",
  label: "Leer",
  hint: "Eine leere Scheibe: Im Modus „Setzen“ entsteht sie Schuss für Schuss.",
}

export const SAMPLES: Readonly<Record<TargetId, readonly Sample[]>> = {
  "lp-10m": [
    FORTY,
    {
      id: "printout",
      label: "Ausdruck vom 2. Oktober",
      hint: "Die sechs Teiler vom Ausdruck des 2. Oktober, auf die Achsen gelegt.",
    },
    TRAINING,
    EMPTY,
  ],
  "lg-10m": [
    FORTY,
    { id: "series", label: "Zehnerserie", hint: "Eine erfundene Zehnerserie." },
    {
      id: "pair",
      label: "Zwei Abreißer",
      hint: "Die Zehnerserie, die letzten beiden Schüsse als Abreißer dicht beieinander (8,3 und 8,0). Einzeln gegen die übrigen geprüft, verdecken sie sich; schrittweise geprüft, fallen beide auf.",
    },
    TRAINING,
    EMPTY,
  ],
}

/** fester Beginn, damit die Beispiele immer gleich sind (2. Oktober 2026, 19:00 Uhr MESZ) */
const START_MS = Date.UTC(2026, 9, 2, 17, 0)

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gauss(rand: () => number) {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/**
 * 40 Schuss mit Probe: neun Probeschüsse (die ersten vier weit daneben), 40
 * Wertungsschüsse in vier Serien, nach Schuss 20 vier Minuten Pause, in der letzten Serie etwas mehr
 * Streuung. LP senkrecht gestreckt (σx 8 mm, σy 12,8 mm) mit einem Abreißer (Schuss 27), LG rund.
 */
function forty(targetId: TargetId): RawShot[] {
  const lg = targetId === "lg-10m"
  const rand = mulberry32(lg ? 20261006 : 20261002)
  const sx = lg ? 1600 : 8000
  const sy = lg ? 1600 : 12800
  const mpi = lg ? [600, -400] : [-3500, 2200]
  const before = lg ? [3000, 2500] : [14000, -9000]
  const pace = (lg ? 42 : 52) * 1000
  const at = (cx: number, cy: number, k = 1) => [
    Math.round((cx + k * sx * gauss(rand)) / 10) * 10,
    Math.round((cy + k * sy * gauss(rand)) / 10) * 10,
  ]
  const shots: RawShot[] = []
  let t = START_MS
  for (let i = 0; i < 9; i++) {
    const [xUm, yUm] = i < 4 ? at(mpi[0] + before[0], mpi[1] + before[1]) : at(mpi[0], mpi[1])
    shots.push({ xUm, yUm, firedAtMs: Math.round(t), kind: "probe" })
    t += pace * Math.exp(0.18 * gauss(rand)) * (i === 3 ? 2.5 : 1)
  }
  t += 80_000
  for (let i = 0; i < 40; i++) {
    const [x, y] = at(mpi[0], mpi[1], i >= 30 ? 1.3 : 1)
    const flyer = !lg && i === 26
    shots.push({
      xUm: flyer ? mpi[0] - 30000 : x,
      yUm: flyer ? mpi[1] - 35000 : y,
      firedAtMs: Math.round(t),
      kind: "match",
    })
    t += i === 19 ? 240_000 : pace * Math.exp(0.2 * gauss(rand))
  }
  return shots
}

/** Training nur mit Probe: 60 Probeschüsse ohne Wertung, nach Schuss 30 gut drei Minuten Pause */
function training(targetId: TargetId): RawShot[] {
  const lg = targetId === "lg-10m"
  const rand = mulberry32(lg ? 20261009 : 20261008)
  const spread = lg ? 1700 : 9000
  const [mx, my] = lg ? [-300, 500] : [1500, -2500]
  const pace = (lg ? 40 : 50) * 1000
  const shots: RawShot[] = []
  let t = START_MS
  for (let i = 0; i < 60; i++) {
    shots.push({
      xUm: Math.round((mx + spread * gauss(rand)) / 10) * 10,
      yUm: Math.round((my + spread * gauss(rand)) / 10) * 10,
      firedAtMs: Math.round(t),
      kind: "probe",
    })
    t += i === 29 ? 200_000 : pace * Math.exp(0.2 * gauss(rand))
  }
  return shots
}

const LG_SERIES = [
  [320, 450],
  [-610, 880],
  [1240, -310],
  [-180, -1290],
  [890, 1020],
  [-1420, 120],
  [410, -720],
  [1730, 640],
  [-830, -560],
  [150, 210],
]

/** zwei Abreißer dicht beieinander als Schuss 9 und 10 der Zehnerserie (8,3 und 8,0 Ringe) */
const PAIR_FLYERS = [
  [5200, 4300],
  [5600, 4700],
]

/** Teiler in 1/100 mm vom Ausdruck des 2. Oktober (ohne Namen) */
const PRINTOUT_TEILER = [331.8, 396.4, 547.4, 2656, 3369, 3831]
const PRINTOUT_ANGLES = [90, 180, 0, 270, 0, 180]

export function rawSample(targetId: TargetId, id: SampleId): RawShot[] {
  if (id === "forty") return forty(targetId)
  if (id === "training") return training(targetId)
  if (id === "empty") return []
  const points =
    id === "series"
      ? LG_SERIES
      : id === "pair"
        ? [...LG_SERIES.slice(0, 8), ...PAIR_FLYERS]
        : PRINTOUT_TEILER.map((teiler, i) => {
            const r = teiler * 10
            const a = (PRINTOUT_ANGLES[i] * Math.PI) / 180
            return [Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a))]
          })
  return points.map(([xUm, yUm], i) => ({
    xUm,
    yUm,
    firedAtMs: START_MS + i * 50_000,
    kind: "match",
  }))
}

/** die Schüsse so, wie der Fachkern sie sieht: Abgabefolge, Wert aus der Lage, Serien zu zehn */
export function toMetricShots(target: TargetImage, raw: readonly RawShot[]): MetricShot[] {
  let match = 0
  return raw.map((shot, i) => {
    const score = scoreFromCoordinates(target, shot.xUm, shot.yUm)
    return {
      seq: i + 1,
      xUm: shot.xUm,
      yUm: shot.yUm,
      decimalTenths: score.decimalTenths,
      ring: score.ring,
      innerTen: score.innerTen,
      firedAtMs: shot.firedAtMs,
      kind: shot.kind,
      series: shot.kind === "match" ? Math.floor(match++ / 10) + 1 : null,
    }
  })
}
