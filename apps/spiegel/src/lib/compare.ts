import type { PatternCard } from "@vereinsheim/shot-core/analysis"
import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import type { TargetId } from "@vereinsheim/shot-core/targets"
import type { CardChoice } from "@vereinsheim/shot-ui/compare/ChoiceSheets"
import {
  cardCompareModel,
  groupCompareModel,
  type CompareModel,
} from "@vereinsheim/shot-ui/compare/model"
import {
  cardSideNames,
  KIND_NAMES,
  periodSideName,
  problemText,
  type CardProblem,
} from "@vereinsheim/shot-ui/compare/words"
import { formatValue } from "@vereinsheim/shot-ui/format"
import type { CompareQuery } from "@vereinsheim/shot-ui/nav/routes"
import {
  compareRange,
  inRange,
  resolveRange,
  type DateRange,
} from "@vereinsheim/shot-ui/period/calendar"
import { fromProjection } from "@vereinsheim/shot-ui/period/fromProjection"
import { byStart, type PeriodItem } from "@vereinsheim/shot-ui/period/model"

import type { Db } from "@/lib/db"
import { cardWithShots, patternCardsOf, type OverviewCard, type PageCard } from "@/lib/db/reads"
import { overviewCards } from "@/lib/overview"
import type { PageContext } from "@/lib/page-context"
import { familiesOf, type FamilyOption } from "@/lib/pages"

// Seite Vergleichen (`vault/spiegel/spiegel-vergleichen.md`): was der Server für A gegen B rechnet. Zeiträume und Arten
// aus den Projektionen der eigenen Scheiben (wie der Fortschritt) und den gespeicherten Lagen, zwei Scheiben aus ihren
// Schüssen. Gerechnet wird in der Wertung der Familie. An den Browser geht das Modell, nie die Schüsse.

type Context = Pick<PageContext, "timeZone" | "nowMs" | "named">

/** ohne Blatt der Scheiben nur die neuesten zwei: Mit ihnen beginnt ein Wechsel auf zwei Scheiben */
const NEWEST_CHOICES = 2

/** so viele Scheiben liest das Bild höchstens, wie das Trefferbild im Fortschritt (`periodPatternAction`) */
const MAX_POSITION_CARDS = 5_000

export interface ComparePageData {
  /** null, wenn kein Vergleich geht (`problem`) */
  model: CompareModel | null
  problem: string | null
  /** die Zeile, wie die Seite sie zeigt: bei zwei Scheiben mit den ergänzten Ids */
  query: CompareQuery
  /** die Familie der Seite: gewählt oder die der Scheibe A */
  family: string
  families: FamilyOption[]
  /** Scheiben der Familie für das Blatt, die neueste zuerst; ohne zwei Scheiben nur die neuesten zwei */
  choices: CardChoice[]
  /** Namen in den Chips; bei Wettkampf und Training ist `a` der Zeitraum */
  names: { a: string; b: string }
  /** die Zeiträume der Seiten, für „Frei“ in den Blättern; bei zwei Scheiben null */
  ranges: { a: DateRange; b: DateRange } | null
  targetId: TargetId
  /** die Wertung der Familie, in der die Seite rechnet (Chip „In Zehnteln“ / „In ganzen Ringen“) */
  scoring: Scoring
  /** Scheibe A, wenn sie geladen ist (Rückweg „Zur Scheibe“); sonst null, auch bei Zeiträumen */
  backCard: string | null
}

const metric = (key: string) => metricByKey(key) as Readonly<MetricDefinition>

/** das Ergebnis einer Scheibe aus der Projektion, in der Wertung („362,4“, „358“); null ohne */
function totalOf(card: OverviewCard, scoring: Scoring): string | null {
  const total = inScoring(metric("result.decimal"), scoring)
  const value = card.projection.values[total.key]?.value
  return value === undefined || value === null ? null : formatValue(value, total.decimals)
}

/** die Scheiben einer Familie für das Blatt, die neueste zuerst */
function choicesOf(cards: readonly OverviewCard[], scoring: Scoring): CardChoice[] {
  return [...cards]
    .sort((a, b) => byStart(b, a))
    .map((card) => ({
      id: card.id,
      startedAtMs: card.startedAtMs,
      total: totalOf(card, scoring),
      shots: card.projection.printedShots,
      ...(card.timeUnknown ? { timeUnknown: true as const } : {}),
    }))
}

/**
 * die Lagen der Scheiben beider Seiten, je Seite die neuesten und höchstens die Hälfte der Obergrenze: So verliert über
 * der Grenze nicht die ältere Seite allein ihre Lagen. Ungelesene zählen im Modell nicht als Scheiben ohne Lage.
 */
async function positionsOf(
  db: Db,
  ownerId: string,
  sides: readonly (readonly PeriodItem[])[]
): Promise<PatternCard[]> {
  const ids = sides.flatMap((items) =>
    [...items]
      .sort((a, b) => byStart(b, a))
      .slice(0, MAX_POSITION_CARDS / sides.length)
      .map((item) => item.id)
  )
  return patternCardsOf(db, { ownerId, ids })
}

/**
 * Die Daten der Seite Vergleichen für eine Abfrage. Zwei Scheiben: Fehlt eine Id, nimmt die Seite die neueste Scheibe
 * und die davor in ihrer Familie. Fehlt eine Scheibe, sind beide dieselbe oder aus verschiedenen Familien, gibt es kein
 * Modell, nur den Hinweis. Zeiträume: A gewinnt Scheiben, die in beiden liegen. Ohne eigene Scheibe null.
 */
export async function comparePageData(
  db: Db,
  ownerId: string,
  query: CompareQuery,
  context: Context
): Promise<ComparePageData | null> {
  const { shown, scoringOf } = await overviewCards(db, ownerId, context.timeZone)
  const families = familiesOf(shown)
  if (!families.length) return null
  // `shown` hat nur Scheiben mit Familie und Scheibenbild (`listable`)
  const ofFamily = (family: string) => shown.filter((card) => card.family?.slug === family)

  if (query.type === "cards") {
    // ohne Ids die beiden neuesten der gewählten Familie, ohne Wahl der Familie der neuesten Scheibe
    const wanted = (families.find((f) => f.value === query.family) ?? families[0]).value
    const newest = ofFamily(wanted).sort((a, b) => byStart(b, a))
    const aId = query.a ?? newest[0]?.id ?? null
    const first = shown.find((card) => card.id === aId)
    const before = first
      ? ofFamily(first.family?.slug ?? "")
          .filter((card) => byStart(card, first) < 0)
          .sort((a, b) => byStart(b, a))[0]
      : undefined
    const bId = query.b ?? before?.id ?? null
    const [a, b] = await Promise.all([
      aId ? cardWithShots(db, { cardId: aId, ownerId }) : null,
      bId ? cardWithShots(db, { cardId: bId, ownerId }) : null,
    ])
    const family = a?.family?.slug ?? b?.family?.slug ?? wanted
    const scoring = scoringOf(family)
    const option = families.find((f) => f.value === family) ?? families[0]
    const problem: CardProblem | null =
      // ohne Familie oder Scheibenbild ist eine Scheibe in keiner Übersicht: wie nicht gefunden
      !a || !b || !a.family || !b.family || !a.targetId || !b.targetId
        ? "missing"
        : a.id === b.id
          ? "same"
          : a.family.slug !== b.family.slug
            ? "families"
            : null
    const card = (page: PageCard | null) => (page ? shown.find((c) => c.id === page.id) : undefined)
    const names = cardSideNames(
      {
        startedAtMs: a?.startedAtMs ?? 0,
        total: (card(a) && totalOf(card(a)!, scoring)) ?? null,
        timeUnknown: a?.timeUnknown,
      },
      {
        startedAtMs: b?.startedAtMs ?? 0,
        total: (card(b) && totalOf(card(b)!, scoring)) ?? null,
        timeUnknown: b?.timeUnknown,
      },
      context.timeZone
    )
    return {
      model:
        problem || !a || !b
          ? null
          : cardCompareModel({
              a,
              b,
              scoring,
              names,
              provenance: { a: a.provenance, b: b.provenance },
              waiting: { a: a.waiting, b: b.waiting },
            }),
      problem: problem && problemText(problem),
      query: { type: "cards", family, a: aId, b: bId },
      family,
      families,
      choices: choicesOf(ofFamily(family), scoring),
      names: { a: a ? names.a.name : "Scheibe wählen", b: b ? names.b.name : "Scheibe wählen" },
      ranges: null,
      targetId: a?.targetId ?? option.targetId,
      scoring,
      backCard: a?.id ?? null,
    }
  }

  const option = families.find((f) => f.value === query.family) ?? families[0]
  const family = option.value
  const scoring = scoringOf(family)
  const cards = ofFamily(family)
  const items = cards.map(fromProjection).sort(byStart)
  const firstMs = items.length ? items[0].startedAtMs : null
  const ctx = { nowMs: context.nowMs, timeZone: context.timeZone, named: context.named, firstMs }
  const within = (range: DateRange, keep: (item: PeriodItem) => boolean) =>
    items.filter((item) => inRange(item.startedAtMs, range) && keep(item))

  if (query.type === "kind") {
    const range = resolveRange(query.range, ctx)
    const a = within(range, (item) => item.kind === "competition")
    const b = within(range, (item) => item.kind === "training")
    return {
      model: groupCompareModel({
        type: "kind",
        a,
        b,
        positions: await positionsOf(db, ownerId, [a, b]),
        scoring,
        includeWarmup: query.includeWarmup,
        names: KIND_NAMES,
        shared: 0,
      }),
      problem: null,
      query: { ...query, family },
      family,
      families,
      choices: choicesOf(cards, scoring).slice(0, NEWEST_CHOICES),
      names: { a: range.label, b: "" },
      ranges: { a: range, b: range },
      targetId: option.targetId,
      scoring,
      backCard: null,
    }
  }

  const rangeA = resolveRange(query.a, ctx)
  const rangeB =
    query.b === "previous"
      ? (compareRange({ type: "previous" }, rangeA, ctx) as DateRange)
      : resolveRange(query.b, ctx)
  const ofKind = (item: PeriodItem) => query.kind === "all" || item.kind === query.kind
  const counts = (item: PeriodItem) => query.includeWarmup || !item.warmup
  const a = within(rangeA, ofKind)
  const inA = new Set(a.map((item) => item.id))
  const bAll = within(rangeB, ofKind)
  const b = bAll.filter((item) => !inA.has(item.id))
  const names = { a: periodSideName(query.a, rangeA), b: periodSideName(query.b, rangeB) }
  return {
    model: groupCompareModel({
      type: "periods",
      a,
      b,
      positions: await positionsOf(db, ownerId, [a, b]),
      scoring,
      includeWarmup: query.includeWarmup,
      names,
      // geteilt zählt, was B ohne die Scheiben von A verliert, nach demselben Filter wie die Seiten (Einschießen)
      shared: bAll.filter(counts).length - b.filter(counts).length,
    }),
    problem: null,
    query: { ...query, family },
    family,
    families,
    choices: choicesOf(cards, scoring).slice(0, NEWEST_CHOICES),
    names: { a: names.a.name, b: names.b.name },
    ranges: { a: rangeA, b: rangeB },
    targetId: option.targetId,
    scoring,
    backCard: null,
  }
}
