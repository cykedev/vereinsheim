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

/** die Lagen der kleinen Scheiben nach Id, wie die App sie zu den gezeigten Scheiben liest */
export const marksOf = (cards: readonly PeriodCard[]): Map<string, MarkShot[]> =>
  new Map(cards.map((card) => [card.id, markShots(cardMarks(card.shots))]))
