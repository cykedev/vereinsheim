// Testkarte für die Analyse: dieselbe erfundene Scheibe wie „40 Schuss“ im früheren Labor (dort wie am Ausdruck ohne die
// neun Probeschüsse, die hier zuerst gezogen werden; `asOnPrintout` nimmt sie heraus) und in der
// Spielwiese (fester Seed, Lagen auf 1/100 mm), damit Tests bekannte Werte prüfen können (Ergebnis 365,2,
// Pause vor Schuss 21, Abreißer Schuss 27 bei der Luftpistole). Nur für Tests, nicht exportiert.

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { LG_10M, LP_10M, type TargetImage } from "@vereinsheim/shot-core/targets"

const START_MS = Date.UTC(2026, 9, 2, 17, 0)

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rand: () => number) {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/** neun Probeschüsse, 40 Wertungsschüsse in vier Serien, nach Schuss 20 vier Minuten Pause */
export function fortyCard(target: TargetImage = LP_10M): MetricShot[] {
  const lg = target === LG_10M
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
  const raw: { xUm: number; yUm: number; firedAtMs: number; kind: "probe" | "match" }[] = []
  let t = START_MS
  for (let i = 0; i < 9; i++) {
    const [xUm, yUm] = i < 4 ? at(mpi[0] + before[0], mpi[1] + before[1]) : at(mpi[0], mpi[1])
    raw.push({ xUm, yUm, firedAtMs: Math.round(t), kind: "probe" })
    t += pace * Math.exp(0.18 * gauss(rand)) * (i === 3 ? 2.5 : 1)
  }
  t += 80_000
  for (let i = 0; i < 40; i++) {
    const [x, y] = at(mpi[0], mpi[1], i >= 30 ? 1.3 : 1)
    const flyer = !lg && i === 26
    raw.push({
      xUm: flyer ? mpi[0] - 30000 : x,
      yUm: flyer ? mpi[1] - 35000 : y,
      firedAtMs: Math.round(t),
      kind: "match",
    })
    t += i === 19 ? 240_000 : pace * Math.exp(0.2 * gauss(rand))
  }
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

/**
 * Die Karte mit einer späten Probe nach Wertungsschuss `matchNumber` (SF-04): Lage wie der Schuss davor,
 * ohne Serie, zur Zeit `atMs` oder in der Mitte des Abstands zum nächsten Schuss; `seq` danach rückt um eins.
 */
export function withSighterAfter(
  card: readonly MetricShot[],
  matchNumber: number,
  atMs?: number
): MetricShot[] {
  const at =
    card.findIndex(
      (s, i) =>
        s.kind === "match" &&
        card.slice(0, i + 1).filter((t) => t.kind === "match").length === matchNumber
    ) + 1
  const before = card[at - 1]
  const firedAtMs = atMs ?? ((before.firedAtMs as number) + (card[at].firedAtMs as number)) / 2
  const sighter: MetricShot = {
    ...before,
    kind: "probe",
    series: null,
    seq: (before.seq as number) + 1,
    firedAtMs,
  }
  return [
    ...card.slice(0, at),
    sighter,
    ...card.slice(at).map((s) => ({ ...s, seq: (s.seq as number) + 1 })),
  ]
}
