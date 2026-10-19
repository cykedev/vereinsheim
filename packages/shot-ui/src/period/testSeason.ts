// Kleine, von Hand gebaute Scheiben für die Tests der Seite eines Zeitraums (nicht exportiert).

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import {
  cardMarks,
  markShots,
  projectCard,
  type MarkShot,
  type ProjectedCard,
} from "@vereinsheim/shot-core/projection"

import { DAY_MS } from "./calendar"
import { fromProjection } from "./fromProjection"
import type { PeriodItem } from "./item"

/** „jetzt“ der Tests: 30. September 2026, 12:00 Uhr MESZ */
export const NOW = Date.UTC(2026, 8, 30, 10)
export const TZ = "Europe/Berlin"

/** eine Scheibe `daysAgo` Tage vor jetzt, Zehntelwerte in Abgabefolge, Lagen nebeneinander im Abstand `spreadUm` */
export function periodCard(
  id: string,
  daysAgo: number,
  tenths: readonly number[],
  extra: Partial<PeriodCard> & { probe?: boolean; spreadUm?: number } = {}
): PeriodCard {
  const { probe, spreadUm = 100, ...rest } = extra
  const startedAtMs = NOW - daysAgo * DAY_MS
  const shots: MetricShot[] = tenths.map((t, i) => ({
    seq: i + 1,
    xUm: spreadUm * i,
    yUm: 0,
    decimalTenths: t,
    ring: Math.floor(t / 10),
    innerTen: t >= 103,
    firedAtMs: startedAtMs + i * 50_000,
    kind: probe ? "probe" : "match",
    series: probe ? null : Math.floor(i / 10) + 1,
  }))
  return { id, startedAtMs, kind: "training", complete: true, shots, ...rest }
}

/** die Scheibe als Eingabe der Übersichten: Merkmale und Projektion (wie die App sie aus der Datenbank liest) */
export const projected = (card: PeriodCard): ProjectedCard => projectCard(card)

/** die Scheibe als Eingabe der Seite eines Zeitraums, wie Spiegel sie bildet (`fromProjection`) */
export const item = (card: PeriodCard): PeriodItem => fromProjection(projectCard(card))

/** die Lagen der kleinen Scheiben nach Id, wie die App sie zu den gezeigten Scheiben liest */
export const marksOf = (cards: readonly PeriodCard[]): Map<string, MarkShot[]> =>
  new Map(cards.map((card) => [card.id, markShots(cardMarks(card.shots))]))

/** feste Folge von Zufallszahlen in [0, 1) (LCG), damit die Saison bei jedem Lauf gleich ist */
function sequence(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

/**
 * Eine Saison über gut ein Jahr für Charakterisierungen des ganzen Modells: Trainings zu 20 und 40 Schuss mit
 * steigender Form, Wettkämpfe, Trainings nur aus Probe, dazu Scheiben, die für Rekorde nicht zählen (unvollständig,
 * „nur-pdf“, verdächtiger Schuss, als Wertung gezählte Probe), und eine Scheibe mit amtlicher Wertung in ganzen Ringen.
 * Zehntel und ganze Ringe gehen auseinander, damit eine vertauschte Wertung auffällt; die Rekorde reichen bis R10/R11.
 */
export function seasonCards(): PeriodCard[] {
  const next = sequence(20_260_930)
  const shots = (n: number, base: number) =>
    Array.from({ length: n }, () =>
      Math.min(109, Math.max(70, Math.round(base + (next() - 0.5) * 24)))
    )
  const cards: PeriodCard[] = []
  for (let i = 0; i < 64; i++) {
    const daysAgo = 400 - i * 6.25 + next()
    const base = 92 + i * 0.12
    cards.push(
      periodCard(`t${String(i).padStart(2, "0")}`, daysAgo, shots(i % 3 === 0 ? 40 : 20, base))
    )
  }
  for (let i = 0; i < 8; i++) {
    cards.push(
      periodCard(`w${i}`, 380 - i * 47 + next(), shots(40, 95 + i * 0.3), { kind: "competition" })
    )
  }
  for (let i = 0; i < 3; i++) {
    cards.push(periodCard(`p${i}`, 120 - i * 50 + next(), shots(10, 96), { probe: true }))
  }
  cards.push(periodCard("unvollstaendig", 15.5, shots(20, 104), { complete: false }))
  cards.push(periodCard("nurpdf", 25.5, shots(40, 104), { flags: ["nur-pdf"] }))
  const odd = periodCard("verdaechtig", 35.5, shots(20, 104))
  cards.push({
    ...odd,
    shots: odd.shots.map((shot, i) => (i === 4 ? { ...shot, flags: ["verdaechtig"] } : shot)),
  })
  cards.push(
    periodCard("gezaehlt", 45.5, shots(20, 103), { probe: true, flags: ["als-wertung-gezaehlt"] })
  )
  cards.push(periodCard("amtlich", 55.5, shots(40, 99), { official: "rings" }))
  return cards
}
