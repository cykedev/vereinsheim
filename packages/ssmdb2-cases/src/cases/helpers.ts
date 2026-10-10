// Bausteine für die Fälle: Disziplinen, Lagen mit festem Zufall, Schießen mit Takt.

import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"

import type { Card, CardSetup, Sim } from "../stand"

type Discipline = Pick<CardSetup, "disziplinId" | "disziplin" | "target" | "display">

/** Disziplinen wie an der Vereinsanlage beobachtet, mit der dort üblichen Anzeigeart */
export const LP40: Discipline = {
  disziplinId: 19210040,
  disziplin: "LP 40 alt",
  target: LP_10M,
  display: 2,
}
export const LP20: Discipline = {
  disziplinId: 10210020,
  disziplin: "LP 20",
  target: LP_10M,
  display: 2,
}
export const LG40: Discipline = {
  disziplinId: 19110040,
  disziplin: "LG 40 alt",
  target: LG_10M,
  display: 1,
}
export const LG20: Discipline = {
  disziplinId: 19110020,
  disziplin: "LG 20 alt",
  target: LG_10M,
  display: 1,
}

/** fester Zufall (mulberry32) */
export function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `n` Lagen in 1/100 mm um eine Mitte, Streuung je Richtung `spread` (1/100 mm), mit festem Zufall */
export function group(
  n: number,
  seed: number,
  spread: number,
  center: readonly [number, number] = [0, 0]
): [number, number][] {
  const rand = random(seed)
  const gauss = () => {
    let u = 0
    while (u === 0) u = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  return Array.from({ length: n }, () => [
    Math.round(center[0] + spread * gauss()),
    Math.round(center[1] + spread * gauss()),
  ])
}

/** ein fester Rest unter einer Sekunde aus der Lage: Die Millisekunden sind echt verteilt (0 bis 999) */
const jitter = (x: number, y: number) => (((x * 7919 + y * 104729) % 1000) + 1000) % 1000

/**
 * Lagen schießen, zwischen zwei Schüssen gut `paceMs` vergehen lassen, mit Millisekunden; das Lebenszeichen läuft mit
 * dem Schuss
 */
export function fire(
  sim: Sim,
  card: Card,
  stellung: 0 | 1,
  positions: readonly (readonly [number, number])[],
  paceMs = 45_000
) {
  for (const [x, y] of positions) {
    card.shot(stellung, x, y)
    sim.advance(paceMs + jitter(x, y))
  }
}

/** sitzen ohne Schuss: alle 8 s ein Lebenszeichen, `ms` lang */
export function wait(sim: Sim, card: Card, ms: number) {
  for (let t = 0; t < ms; t += 8_000) {
    sim.advance(Math.min(8_000, ms - t))
    card.heartbeat()
  }
}

/** die Uhr läuft, der Stand ist frei: kein Lebenszeichen */
export function away(sim: Sim, ms: number) {
  sim.advance(ms)
}

/** die Uhr bis `ms` vorstellen (nie zurück), ohne Lebenszeichen */
export function until(sim: Sim, ms: number) {
  if (ms < sim.now) throw new Error("Die Uhr geht nicht zurück")
  sim.advance(ms - sim.now)
}

/** Minuten in ms */
export const minutes = (n: number) => n * 60_000
