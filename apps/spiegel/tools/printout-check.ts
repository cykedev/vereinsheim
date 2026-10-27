// Gegenprobe ([[meyton-printout]]): Was ein Meyton-Ausdruck zeigt, gemessen an den Rohdaten derselben Scheibe in der lokalen
// Dev-Datenbank. Liest alle PDFs eines Ordners, nimmt die Ausdrucke des häufigsten Schützen (die übrigen nur gezählt),
// ordnet sie über die ID im Fuß und den Abend der Druckzeit den Scheiben des Kontos zu und vergleicht Werte, Summen,
// Teiler, Trefferlage, Trefferkreis, Streuwert und die gezeichneten Lagen.
//
// Der Bericht nach `reports/tis-1c0/` (gitignored) enthält nur Zahlen: keine ID, kein Name, kein Datum einzelner
// Scheiben (ADR-029). Nur gegen die lokale Dev-Datenbank (`--force` für eine andere lokale).
//
//   pnpm --filter spiegel printout-check <ordner>                    dem Konto aus SEED_ADMIN_EMAIL
//   pnpm --filter spiegel printout-check <ordner> --email <adresse>  einem anderen Konto

import "dotenv/config"

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { readPrintout } from "@vereinsheim/meyton-pdf/printout"
import { zonedWallTimeMs } from "@vereinsheim/lib/format"
import { readPrintoutValues, type PrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { LP_10M, TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import { createPrismaClient, type Db } from "../src/lib/db"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { assertDevDatabase } from "./dev-guard"
import {
  checkLabels,
  compareCenter,
  compareShots,
  compareSums,
  compareTeiler,
  drawnMm,
  fitDrawn,
  HIT_CIRCLE_CANDIDATES,
  hitCircleCandidates,
  labelDeviations,
  matchDiscipline,
  nearestCandidate,
  ringDiametersMm,
  scaleFromRings,
  selfCheck,
  SPREAD_CANDIDATES,
  spreadCandidates,
  summarize,
  teilerFromMm,
  type RawShot,
  type Summary,
} from "./printout-check/compare"

const REPORT_DIR = resolve(__dirname, "../../../reports/tis-1c0")

interface ReadFile {
  values: PrintoutValues
  /** ID im Fuß als ScheibenID; null ohne eindeutige ID */
  scheibenId: number | null
  printedAtMs: number | null
  /** Monat der Druckzeit, nur für den Zeitraum eines Layouts */
  printedMonth: string | null
  producer: string | null
  creator: string | null
  pages: number
}

interface Candidate {
  startedAt: Date
  targetId: string | null
  stand: string | null
  /** Disziplin vom Stand: die gewählte ersetzt sie nicht */
  disciplineName: string
  /** erster Wertungsschuss in ms; null ohne Zeit */
  firstScoredMs: number | null
  /** erster Schuss überhaupt (auch Probe) in ms; null ohne Zeit */
  firstShotMs: number | null
  probe: RawShot[]
  scored: RawShot[]
}

// ── Sammeln ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Zähler nach Schlüssel */
class Tally {
  readonly counts = new Map<string, number>()
  add(key: string, by = 1) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + by)
  }
  get(key: string) {
    return this.counts.get(key) ?? 0
  }
  lines(): string[] {
    return [...this.counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, n]) => `| ${key} | ${n} |`)
  }
}

/** gleich/gesamt je Art */
class Ratio {
  readonly parts = new Map<string, { equal: number; total: number }>()
  add(key: string, equal: boolean) {
    this.addCounts(key, equal ? 1 : 0, 1)
  }
  addCounts(key: string, equal: number, total: number) {
    const part = this.parts.get(key) ?? { equal: 0, total: 0 }
    part.total += total
    part.equal += equal
    this.parts.set(key, part)
  }
  lines(): string[] {
    return [...this.parts].map(
      ([key, p]) => `| ${key} | ${p.equal} / ${p.total} | ${percent(p.equal / p.total)} |`
    )
  }
}

/** Werte je Art für `summarize` */
class Samples {
  readonly values = new Map<string, number[]>()
  add(key: string, value: number) {
    const list = this.values.get(key) ?? []
    list.push(value)
    this.values.set(key, list)
  }
  get(key: string): number[] {
    return this.values.get(key) ?? []
  }
}

const num = (value: number | null, digits = 3) => (value === null ? "–" : value.toFixed(digits))
const percent = (share: number | null) => (share === null ? "–" : `${(100 * share).toFixed(1)} %`)
const summaryRow = (label: string, s: Summary, digits = 3) =>
  `| ${label} | ${s.n} | ${num(s.median, digits)} | ${num(s.p95, digits)} | ${num(s.max, digits)} |`

function rawShot(s: {
  series: number | null
  xUm: number | null
  yUm: number | null
  ring: number | null
  decimalTenths: number | null
  innerTen: boolean | null
  distanceTenthsUm: number | null
}): RawShot | null {
  if (s.xUm === null || s.yUm === null || s.decimalTenths === null || s.distanceTenthsUm === null)
    return null
  return {
    xUm: s.xUm,
    yUm: s.yUm,
    series: s.series,
    ring: s.ring,
    decimalTenths: s.decimalTenths,
    innerTen: s.innerTen === true,
    distanceTenthsUm: s.distanceTenthsUm,
  }
}

async function candidates(db: Db, email: string, scheibenIds: number[]) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) throw new Error("Konto nicht gefunden (--email oder SEED_ADMIN_EMAIL)")
  const site = await db.site.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, timeZone: true },
  })
  if (!site) throw new Error("keine Anlage in der Datenbank")
  const cards = await db.card.findMany({
    where: { ownerId: user.id, source: { siteId: site.id }, scheibenId: { in: scheibenIds } },
    select: {
      scheibenId: true,
      startedAt: true,
      stand: true,
      discipline: { select: { targetId: true, name: true } },
      standDiscipline: { select: { name: true } },
      currentRevision: {
        select: {
          shots: {
            orderBy: [{ stellung: "asc" }, { treffer: "asc" }],
            select: {
              stellung: true,
              series: true,
              xUm: true,
              yUm: true,
              ring: true,
              decimalTenths: true,
              innerTen: true,
              distanceTenthsUm: true,
              firedAt: true,
            },
          },
        },
      },
    },
  })
  const byId = new Map<number, Candidate[]>()
  let skippedCards = 0
  for (const card of cards) {
    const shots = card.currentRevision?.shots ?? []
    const pick = (stellung: (n: number) => boolean) =>
      shots.filter((s) => stellung(s.stellung)).map(rawShot)
    const probe = pick((n) => n === 0)
    const scored = pick((n) => n !== 0)
    if (probe.includes(null) || scored.includes(null)) {
      skippedCards++
      continue
    }
    const firedAt = (stellung: (n: number) => boolean) =>
      shots
        .filter((s) => stellung(s.stellung) && s.firedAt !== null)
        .map((s) => s.firedAt!.getTime())
    const fired = firedAt((n) => n !== 0)
    const firedAll = firedAt(() => true)
    const list = byId.get(card.scheibenId!) ?? []
    list.push({
      startedAt: card.startedAt,
      targetId: card.discipline.targetId,
      stand: card.stand,
      disciplineName: (card.standDiscipline ?? card.discipline).name,
      firstScoredMs: fired.length > 0 ? Math.min(...fired) : null,
      firstShotMs: firedAll.length > 0 ? Math.min(...firedAll) : null,
      probe: probe as RawShot[],
      scored: scored as RawShot[],
    })
    byId.set(card.scheibenId!, list)
  }
  const disciplines = await db.discipline.findMany({
    where: { siteId: site.id },
    select: { name: true },
  })
  return {
    byId,
    timeZone: site.timeZone,
    accountCards: cards.length,
    skippedCards,
    disciplineNames: disciplines.map((d) => d.name),
  }
}

/** Probe- oder Wertungsschüsse, wie der Modus beim Druck sagt; ohne klaren Modus die, deren Werte passen */
function shownShots(values: PrintoutValues, card: Candidate): { shots: RawShot[]; by: string } {
  const mode = values.mode ?? ""
  if (/probe/i.test(mode)) return { shots: card.probe, by: "Modus Probe → Probeschüsse" }
  if (/wertung/i.test(mode)) return { shots: card.scored, by: "Modus Wertung → Wertungsschüsse" }
  const fits = (shots: RawShot[]) => compareShots(values.shots, shots).valueEqual
  return fits(card.probe) > fits(card.scored)
    ? { shots: card.probe, by: `Modus ${modeLabel(values)} → Probeschüsse (Werte passen)` }
    : { shots: card.scored, by: `Modus ${modeLabel(values)} → Wertungsschüsse (Werte passen)` }
}

// Freitext aus dem Kopf geht nur in den Bericht, wenn er wie ein Modus oder eine Disziplin aussieht; in einem anderen
// Layout könnte an dieser Stelle ein Name stehen.
const MODES = ["Probe", "Wertung", "Training", "Vorbereitung/Probe"]
const modeLabel = (values: PrintoutValues) =>
  values.mode === null ? "–" : MODES.includes(values.mode) ? values.mode : "anderer"
const disciplineLabel = (values: PrintoutValues) =>
  values.discipline === null
    ? "–"
    : /^(LP|LG|KK|GK|ZS|Lp|Lg)\b[\w\s.\-−/]*$/.test(values.discipline)
      ? values.discipline
      : "andere"

function layoutOf(values: PrintoutValues): string {
  if (values.layout.includes("Trefferkreis:")) return "mit Trefferkreis"
  if (values.layout.includes("Streuwert:")) return "mit Streuwert"
  return "ohne beides"
}

function drawingOf(values: PrintoutValues): string {
  if (values.pictures.length === 0) return "kein Trefferbild"
  const shape = values.pictures.find((p) => p.holeShape !== null)?.holeShape
  const labels = values.pictures.some((p) => p.labels.length > 0)
  return `${values.pictures.length} Bilder, Treffer als ${shape === "cross" ? "Kreuz" : shape === "circle" ? "Kreis" : "–"}${labels ? " mit Nummer" : " ohne Nummer"}`
}

// ── Lauf ───────────────────────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const folder = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--email")
  if (!folder) throw new Error("Ordner mit PDFs angeben")
  const emailAt = args.indexOf("--email")
  const email = emailAt === -1 ? (process.env.SEED_ADMIN_EMAIL ?? "") : (args[emailAt + 1] ?? "")
  const url = process.env.DATABASE_URL ?? DEV_DATABASE_URL
  assertDevDatabase(url, args.includes("--force"))

  // lesen
  const files = readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".pdf"))
  const read: ReadFile[] = []
  let unreadable = 0
  for (const file of files) {
    const bytes = new Uint8Array(readFileSync(join(folder, file)))
    try {
      const [values, printout] = await Promise.all([readPrintoutValues(bytes), readPrintout(bytes)])
      read.push({
        values,
        scheibenId: printout.id.kind === "found" ? printout.id.value : null,
        printedAtMs: printout.createdAt?.epochMs ?? null,
        printedMonth: printout.createdAt?.local.slice(0, 7) ?? null,
        producer: printout.producer,
        creator: printout.creator,
        pages: printout.pages,
      })
    } catch {
      unreadable++
    }
  }

  // eigene Ausdrucke: der häufigste Name, als Menge seiner Wörter (auch „Vorname, Nachname“); die übrigen nur gezählt
  const nameOf = (r: ReadFile) =>
    r.values.shooter
      ?.toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
      .sort()
      .join(" ") ?? null
  const names = new Tally()
  for (const r of read) {
    const name = nameOf(r)
    if (name) names.add(name)
  }
  const owner = [...names.counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const own = read.filter((r) => owner !== null && nameOf(r) === owner)
  const noName = read.filter((r) => nameOf(r) === null).length
  const otherName = read.length - own.length - noName

  const ids = [...new Set(own.flatMap((r) => (r.scheibenId === null ? [] : [r.scheibenId])))]
  const db = createPrismaClient(url)
  const { byId, timeZone, accountCards, skippedCards, disciplineNames } = await candidates(
    db,
    email,
    ids
  ).finally(() => db.$disconnect())

  // Abdeckung
  const coverage = new Tally()
  const layouts = new Tally()
  const disciplines = new Tally()
  const modes = new Tally()
  const drawings = new Tally()
  const producers = new Tally()
  const missingFields = new Tally()
  // Layouts nach Metadaten und erkannten Zeilen, mit Zeitraum (Monat der ersten und letzten Druckzeit)
  const layoutGroups = new Tally()
  const layoutMonths = new Map<string, string[]>()
  const drawingMonths = new Map<string, string[]>()
  // Marken über alle eigenen Bilder: außerhalb des Rahmens, Größe des Rahmens je Art der Marke (Ringe der Luftpistole)
  const markOutside = new Tally()
  const frameMm = new Samples()
  const span = (months: readonly string[] | undefined) => {
    const sorted = [...(months ?? [])].sort()
    return sorted.length > 0 ? `${sorted[0]} bis ${sorted.at(-1)}` : "–"
  }
  // Selbstprüfung: passen die gelesenen Werte zu den gedruckten Summen?
  const selfRatio = new Ratio()
  const selfPrintouts = new Tally()
  // Disziplin im Kopf gegen die Disziplinen der Anlage
  const disciplineMatch = new Tally()
  for (const r of own) {
    const key = [
      r.producer ?? "–",
      r.creator ?? "–",
      `${r.pages} Seite${r.pages === 1 ? "" : "n"}`,
      r.values.layout.filter((l) => !l.startsWith("Serie ")).join(" "),
    ].join(" · ")
    layoutGroups.add(key)
    if (r.printedMonth) layoutMonths.set(key, [...(layoutMonths.get(key) ?? []), r.printedMonth])
    for (const picture of r.values.pictures) {
      if (!picture.frame || picture.holeShape === null) continue
      const frame = picture.frame
      const shape = picture.holeShape === "cross" ? "Kreuz" : "Kreis"
      markOutside.add(`${shape}: Marken`, picture.holes.length)
      markOutside.add(
        `${shape}: außerhalb des Rahmens`,
        picture.holes.filter(
          (h) => h.x < frame.left || h.x > frame.right || h.y < frame.bottom || h.y > frame.top
        ).length
      )
      const ptPerMm = scaleFromRings(picture.ringDiametersPt, ringDiametersMm(LP_10M))
      if (ptPerMm !== null) frameMm.add(shape, (frame.right - frame.left) / ptPerMm)
    }
    const checks = selfCheck(r.values)
    for (const c of checks) selfRatio.add(c.what, c.printed === c.fromShots)
    selfPrintouts.add(
      checks.length === 0
        ? "ohne Werte je Schuss"
        : checks.every((c) => c.printed === c.fromShots)
          ? "alle Summen passen"
          : "mindestens ein Widerspruch"
    )
    disciplineMatch.add(
      r.values.discipline === null
        ? "kein Name im Kopf"
        : {
            exact: "genau eine, wörtlich",
            normalized: "genau eine, nach Normalisieren",
            ambiguous: "mehrere",
            none: "keine",
          }[matchDiscipline(r.values.discipline, disciplineNames).kind]
    )
    layouts.add(layoutOf(r.values))
    disciplines.add(disciplineLabel(r.values))
    modes.add(modeLabel(r.values))
    drawings.add(drawingOf(r.values))
    if (r.printedMonth)
      drawingMonths.set(drawingOf(r.values), [
        ...(drawingMonths.get(drawingOf(r.values)) ?? []),
        r.printedMonth,
      ])
    producers.add(r.producer?.replace(/\d+(\.\d+)*$/, "").trim() || "–")
    const v = r.values
    const fields: [string, unknown][] = [
      ["Ergebnis", v.result],
      ["Serien", v.seriesRings],
      ["Zähler", v.counts],
      ["Innenzehner", v.innerTens],
      ["beste Teiler", v.bestTeiler],
      ["Weiteste", v.widestTeiler],
      ["Trefferlage", v.centerMm],
      ["Trefferkreis", v.hitCircleMm],
      ["Streuwert", v.spread],
      ["Werte je Schuss", v.shots.length > 0 ? v.shots : null],
      ["Teiler je Schuss", v.shots.some((s) => s.teiler !== null) ? true : null],
      ["Trefferbild", v.pictures.length > 0 ? v.pictures : null],
    ]
    for (const [field, value] of fields) if (value === null) missingFields.add(field)
  }

  // Paare
  interface Pair {
    n: number
    file: ReadFile
    card: Candidate
    shots: RawShot[]
    by: string
  }
  const pairs: Pair[] = []
  for (const r of own) {
    if (r.scheibenId === null) {
      coverage.add("ohne ID im Fuß")
      continue
    }
    const list = byId.get(r.scheibenId)
    if (!list) {
      coverage.add("ID ohne Scheibe des Kontos")
      continue
    }
    const day = r.printedAtMs === null ? null : eveningDay(r.printedAtMs, timeZone)
    const sameEvening = list.filter(
      (c) => day === null || eveningDay(c.startedAt.getTime(), timeZone) === day
    )
    if (sameEvening.length === 0) {
      coverage.add("Scheibe da, aber anderer Abend")
      continue
    }
    // mehrere Blöcke eines Abends: der, dessen Werte am besten passen
    const scored = sameEvening
      .map((card) => ({ card, ...shownShots(r.values, card) }))
      .map((c) => ({ ...c, fit: compareShots(r.values.shots, c.shots).valueEqual }))
      .sort((a, b) => b.fit - a.fit)
    if (scored.length > 1) coverage.add("mehrere Blöcke am Abend (bester gewählt)")
    const best = scored[0]
    if (best.shots.length === 0) {
      coverage.add("Scheibe ohne Schüsse im Modus des Ausdrucks")
      continue
    }
    coverage.add("zugeordnet")
    pairs.push({ n: pairs.length + 1, file: r, card: best.card, shots: best.shots, by: best.by })
  }

  // Werte, Summen
  const shotRatio = new Ratio()
  const sumRatio = new Ratio()
  const selection = new Tally()
  let partial = 0
  // Teiler
  const teilerRatio = new Ratio()
  const teilerDiff = new Samples()
  // Trefferlage
  const centerRatio = new Ratio()
  const centerDist = new Samples()
  // Trefferkreis, Streuwert
  const circleDiff = new Samples()
  const circleNearest = new Tally()
  const spreadDiff = new Samples()
  // Erweiterung: Fuß, Kopf, Teiler aus den Marken
  const headRatio = new Ratio()
  const initDiff = new Samples()
  const rawRingRatio = new Ratio()
  const markTeiler = new Samples()
  // Trefferbild
  const drawn = new Samples()
  const labelTally = new Tally()
  const resolution = new Samples()
  const table: string[] = []

  for (const pair of pairs) {
    const v = pair.file.values
    const raw = pair.shots
    const shown = raw.slice(0, v.shots.length || raw.length)
    selection.add(pair.by)
    if (v.shots.length > 0 && v.shots.length < raw.length) partial++

    const shots = compareShots(v.shots, raw)
    for (const s of raw)
      if (s.ring !== null)
        rawRingRatio.add(
          "Ring der Rohdaten = ganze Zahl des Werts",
          s.ring === Math.floor(s.decimalTenths / 10)
        )
    if (v.stand !== null && pair.card.stand !== null)
      headRatio.add("Standnummer = Card.stand", v.stand === pair.card.stand)
    if (v.discipline !== null) {
      const match = matchDiscipline(v.discipline, disciplineNames)
      headRatio.add(
        "Disziplin im Kopf = Disziplin vom Stand",
        "index" in match && disciplineNames[match.index] === pair.card.disciplineName
      )
    }
    if (v.initialized !== null) {
      const [date, time] = v.initialized.split("T")
      const [y, mo, d] = date.split("-").map(Number)
      const [h, mi] = time.split(":").map(Number)
      const initializedMs = zonedWallTimeMs(Date.UTC(y, mo - 1, d, h, mi), timeZone)
      if (pair.card.firstScoredMs !== null)
        initDiff.add(
          `erster Wertungsschuss − initialisiert (${modeLabel(v)})`,
          (pair.card.firstScoredMs - initializedMs) / 1000
        )
      if (pair.card.firstShotMs !== null)
        initDiff.add(
          `erster Schuss − initialisiert (${modeLabel(v)})`,
          (pair.card.firstShotMs - initializedMs) / 1000
        )
    }
    shotRatio.addCounts("Werte je Schuss (Zehntel)", shots.valueEqual, shots.compared)
    shotRatio.addCounts("Innenzehner je Schuss", shots.innerTenEqual, shots.compared)
    if (shots.teilerCompared > 0) {
      shotRatio.addCounts(
        "Teiler je Schuss = abgeschnitten",
        shots.teilerTruncated,
        shots.teilerCompared
      )
      shotRatio.addCounts("Teiler je Schuss = gerundet", shots.teilerRounded, shots.teilerCompared)
    }
    const sums = compareSums(v, raw)
    for (const check of sums)
      sumRatio.add(check.what.replace(/\d+/, "n").replace(/ n$/, ""), check.printed === check.raw)

    // Teiler: Einheit 1/100 mm, gerundet oder abgeschnitten
    const teilerRows: {
      refs: typeof v.bestTeiler
      kind: "best" | "widest"
      label: string
      shots: RawShot[]
      numbers?: number[]
    }[] = [
      { refs: v.bestTeiler, kind: "best", label: "beste Teiler (Scheibe)", shots: shown },
      { refs: v.widestTeiler, kind: "widest", label: "weiteste Teiler (Scheibe)", shots: shown },
    ]
    let offset = 0
    for (const series of v.series) {
      const count = series.shots.length
      const part = shown.slice(offset, offset + count)
      const numbers = part.map((_, i) => offset + i + 1)
      offset += count
      if (part.length === count && count > 0)
        teilerRows.push({
          refs: series.bestTeiler,
          kind: "best",
          label: "beste Teiler (Serie)",
          shots: part,
          numbers,
        })
    }
    let teilerOk = 0
    let teilerAll = 0
    for (const row of teilerRows) {
      if (!row.refs) continue
      for (const check of compareTeiler(row.refs, row.shots, row.kind, row.numbers)) {
        teilerAll++
        if (check.raw === null) {
          teilerRatio.add(`${row.label}: Schussnummer vorhanden`, false)
          continue
        }
        teilerRatio.add(`${row.label}: = gerundet`, check.rounded)
        teilerRatio.add(`${row.label}: = abgeschnitten`, check.truncated)
        teilerRatio.add(`${row.label}: Rang stimmt`, check.rankOk)
        teilerDiff.add(row.label, check.diff ?? 0)
        if ((check.rounded || check.truncated) && check.rankOk) teilerOk++
      }
    }

    // Trefferlage
    const centers: { label: string; printed: typeof v.centerMm; shots: RawShot[] }[] = [
      { label: "Scheibe", printed: v.centerMm, shots: shown },
    ]
    offset = 0
    for (const series of v.series) {
      const part = shown.slice(offset, offset + series.shots.length)
      offset += series.shots.length
      if (part.length === series.shots.length && part.length > 0)
        centers.push({ label: "Serie", printed: series.centerMm, shots: part })
    }
    let centerWorst: number | null = null
    for (const c of centers) {
      if (!c.printed) continue
      const check = compareCenter(c.printed, c.shots)
      if (!check) continue
      centerDist.add(c.label, check.distanceMm)
      centerRatio.add(`${c.label}: = abgeschnitten (1/100 mm)`, check.truncated)
      centerRatio.add(`${c.label}: = gerundet (1/100 mm)`, check.rounded)
      for (const [axis, p, r] of [
        ["x", check.printed.x, check.raw.x],
        ["y", check.printed.y, check.raw.y],
      ] as const)
        if (Math.abs(r) >= 0.05)
          centerRatio.add(
            `${c.label}: Vorzeichen ${axis} wie Spiegel`,
            Math.sign(p) === Math.sign(r)
          )
      centerWorst = Math.max(centerWorst ?? 0, check.distanceMm)
    }

    // Trefferkreis und Streuwert
    const target =
      pair.card.targetId && Object.hasOwn(TARGETS, pair.card.targetId)
        ? TARGETS[pair.card.targetId as TargetId]
        : null
    const caliber = target?.caliberMm ?? 4.5
    let circleBest = "–"
    const groups: {
      label: string
      circle: number | null
      spread: typeof v.spread
      shots: RawShot[]
    }[] = [{ label: "Scheibe", circle: v.hitCircleMm, spread: v.spread, shots: shown }]
    offset = 0
    for (const series of v.series) {
      const part = shown.slice(offset, offset + series.shots.length)
      offset += series.shots.length
      if (part.length === series.shots.length && part.length > 0)
        groups.push({
          label: "Serie",
          circle: series.hitCircleMm,
          spread: series.spread,
          shots: part,
        })
    }
    for (const g of groups) {
      if (g.circle !== null) {
        const cands = hitCircleCandidates(g.shots, caliber)
        if (cands) {
          for (const k of HIT_CIRCLE_CANDIDATES)
            circleDiff.add(`${g.label}: ${k}`, g.circle - cands[k])
          const nearest = nearestCandidate(g.circle, cands)
          circleNearest.add(`${g.label}: ${nearest.candidate}`)
          if (g.label === "Scheibe") circleBest = nearest.candidate
        }
      }
      if (g.spread) {
        const cands = spreadCandidates(g.shots)
        if (cands)
          for (const k of SPREAD_CANDIDATES) {
            spreadDiff.add(`${g.label}: ${k} gesamt`, g.spread.overall - cands[k].overall)
            if (g.spread.horizontal !== null)
              spreadDiff.add(
                `${g.label}: ${k} horizontal`,
                g.spread.horizontal - cands[k].horizontal!
              )
            if (g.spread.vertical !== null)
              spreadDiff.add(`${g.label}: ${k} vertikal`, g.spread.vertical - cands[k].vertical!)
          }
      }
    }

    // Trefferbild: erstes Bild die ganze Scheibe, dann je Serie eins
    let drawnWorst: number | null = null
    const pictureShots: { label: string; shots: RawShot[]; first: number }[] = []
    if (v.pictures.length === v.series.length + 1) {
      pictureShots.push({ label: "ganze Scheibe", shots: shown, first: 1 })
      offset = 0
      for (const series of v.series) {
        pictureShots.push({
          label: "Serie",
          shots: shown.slice(offset, offset + series.shots.length),
          first: offset + 1,
        })
        offset += series.shots.length
      }
    } else if (v.pictures.length > 0) labelTally.add("Bilder passen nicht zu den Serien")
    v.pictures.forEach((picture, i) => {
      const part = pictureShots[i]
      if (!part || picture.holes.length === 0) return
      if (picture.holes.length !== part.shots.length) {
        labelTally.add("Marken ≠ Schüsse")
        return
      }
      const ptPerMm = target
        ? scaleFromRings(picture.ringDiametersPt, ringDiametersMm(target))
        : null
      const fit = fitDrawn(
        picture.holes,
        part.shots,
        ptPerMm === null ? null : { center: picture.center, ptPerMm }
      )
      if (!fit) return
      const shape = picture.holeShape === "cross" ? "Kreuz" : "Kreis"
      for (const d of fit.fromRings ?? []) {
        drawn.add(`${part.label}, ${shape}: aus den Ringen`, d)
        drawn.add("alle: aus den Ringen", d)
        drawnWorst = Math.max(drawnWorst ?? 0, d)
      }
      for (const d of fit.fitted) drawn.add(`${part.label}, ${shape}: beste Ausrichtung`, d)
      if (ptPerMm !== null && part.label === "ganze Scheibe") {
        const rings = { center: picture.center, ptPerMm }
        picture.holes.forEach((h, k) => {
          const fromMark = teilerFromMm(drawnMm(h, rings))
          markTeiler.add(
            "Teiler aus der Marke − roh",
            fromMark - part.shots[k].distanceTenthsUm / 100
          )
        })
        for (const ref of v.bestTeiler ?? []) {
          const hole = picture.holes[ref.shot - 1]
          if (hole)
            markTeiler.add(
              "gedruckter bester Teiler − Teiler aus der Marke",
              ref.value - teilerFromMm(drawnMm(hole, rings))
            )
        }
      }
      if (picture.labels.length > 0 && ptPerMm !== null)
        for (const d of labelDeviations(picture, part.first, part.shots, {
          center: picture.center,
          ptPerMm,
        }))
          drawn.add(`${part.label}: Nummer zur Lage der Rohdaten`, d)
      if (ptPerMm !== null) resolution.add(part.label, 1 / ptPerMm)
      if (picture.labels.length > 0 && ptPerMm !== null) {
        const labels = checkLabels(picture, part.first, ptPerMm)
        labelTally.add(`${part.label}: Schüsse`, picture.holes.length)
        labelTally.add(`${part.label}: Nummer fehlt`, labels.missing)
        labelTally.add(`${part.label}: Marke überdeckt eine andere`, labels.covered)
        for (const o of labels.offsetsMm) drawn.add(`${part.label}: Nummer zur Marke`, o)
      }
    })

    table.push(
      `| ${pair.n} | ${layoutOf(v)} | ${modeLabel(v)} | ${shots.compared} / ${raw.length} | ${shots.valueEqual} | ${shots.innerTenEqual} | ${sums.filter((s) => s.printed === s.raw).length} / ${sums.length} | ${teilerOk} / ${teilerAll} | ${num(centerWorst, 3)} | ${circleBest} | ${num(drawnWorst, 3)} |`
    )
  }

  // Bericht
  const out: string[] = []
  const line = (text = "") => out.push(text)
  const today = new Date().toISOString().slice(0, 10)
  line(`# Gegenprobe Ausdruck gegen Rohdaten (${today})`)
  line()
  line(
    "Nur Zahlen, ohne ID, Name oder Datum einzelner Scheiben (ADR-029). Längen in mm, Teiler in 1/100 mm."
  )
  line()
  line("## Abdeckung")
  line()
  line("| | Anzahl |")
  line("|---|---|")
  line(`| PDFs im Ordner | ${files.length} |`)
  line(`| nicht lesbar | ${unreadable} |`)
  line(`| eigene (häufigster Name) | ${own.length} |`)
  line(`| anderer Name | ${otherName} |`)
  line(`| ohne Name | ${noName} |`)
  line(`| verschiedene IDs der eigenen | ${ids.length} |`)
  line(`| davon mit Scheibe des Kontos | ${byId.size} |`)
  line(`| Scheiben des Kontos zu diesen IDs (Blöcke) | ${accountCards} |`)
  line(`| davon ohne Lage, Wert oder Abstand je Schuss (nicht verglichen) | ${skippedCards} |`)
  for (const row of coverage.lines()) out.push(row)
  for (const [title, tally] of [
    ["Layout", layouts],
    ["Erzeuger", producers],
    ["Disziplin", disciplines],
    ["Modus", modes],
    ["fehlt im eigenen Ausdruck", missingFields],
  ] as const) {
    line()
    line(`| ${title} | Ausdrucke |`)
    line("|---|---|")
    for (const row of tally.lines()) out.push(row)
  }
  line()
  line("| Layout (Erzeuger · Ersteller · Seiten · erkannte Zeilen) | Ausdrucke | Zeitraum |")
  line("|---|---|---|")
  for (const [key, n] of [...layoutGroups.counts].sort((a, b) => b[1] - a[1]))
    out.push(`| ${key} | ${n} | ${span(layoutMonths.get(key))} |`)
  line()
  line("| Trefferbild | Ausdrucke | Zeitraum |")
  line("|---|---|---|")
  for (const [key, n] of [...drawings.counts].sort((a, b) => b[1] - a[1]))
    out.push(`| ${key} | ${n} | ${span(drawingMonths.get(key))} |`)
  line()
  line("### Selbstprüfung über alle eigenen Ausdrucke")
  line()
  line("Gelesene Werte je Schuss gegen die gedruckten Summen (Ring = ganze Zahl des Werts).")
  line()
  line("| Ausdrucke | Anzahl |")
  line("|---|---|")
  for (const row of selfPrintouts.lines()) out.push(row)
  line()
  line("| Angabe | passt / geprüft | Anteil |")
  line("|---|---|---|")
  for (const row of selfRatio.lines()) out.push(row)
  line()
  line("### Disziplin im Kopf gegen die Disziplinen der Anlage")
  line()
  line("| Zuordnung | Ausdrucke |")
  line("|---|---|")
  for (const row of disciplineMatch.lines()) out.push(row)
  line()
  line("## Kopf und Fuß gegen die Scheibe")
  line()
  line("| Angabe | gleich / verglichen | Anteil |")
  line("|---|---|---|")
  for (const row of [...headRatio.lines(), ...rawRingRatio.lines()]) out.push(row)
  line()
  line("| Zeit in s (initialisiert auf die Minute) | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of initDiff.values) {
    out.push(summaryRow(key, summarize(values), 0))
    out.push(
      `| … kleinster, größter Wert | ${values.length} | ${Math.min(...values).toFixed(0)} | | ${Math.max(...values).toFixed(0)} |`
    )
  }
  line()
  line("## Werte je Schuss, Serien, Ergebnis")
  line()
  line(
    `${pairs.length} Paare; ${partial} Ausdrucke zeigen weniger Schüsse als die Rohdaten (Zwischenausdruck).`
  )
  line()
  line("| Auswahl der Schüsse | Paare |")
  line("|---|---|")
  for (const row of selection.lines()) out.push(row)
  line()
  line("| Angabe | gleich / verglichen | Anteil |")
  line("|---|---|---|")
  for (const row of [...shotRatio.lines(), ...sumRatio.lines()]) out.push(row)
  line()
  line("## Teiler")
  line()
  line("Roh: `distanceTenthsUm / 100` (1/100 mm). Beste mit einer Nachkommastelle, weiteste ganz.")
  line()
  line("| Angabe | gleich / verglichen | Anteil |")
  line("|---|---|---|")
  for (const row of teilerRatio.lines()) out.push(row)
  line()
  line("| Abweichung gedruckt − roh | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of teilerDiff.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("## Trefferlage")
  line()
  line("| Angabe | gleich / verglichen | Anteil |")
  line("|---|---|---|")
  for (const row of centerRatio.lines()) out.push(row)
  line()
  line("| Abstand gedruckt zu Schwerpunkt | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of centerDist.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("## Trefferkreis und Streuwert")
  line()
  line("| nächster Kandidat | Anzahl |")
  line("|---|---|")
  for (const row of circleNearest.lines()) out.push(row)
  line()
  line("| Trefferkreis − Kandidat | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of circleDiff.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("| Streuwert − Kandidat | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of spreadDiff.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("## Trefferbild")
  line()
  line("Abweichung der gezeichneten Marke von der Lage der Rohdaten je Schuss.")
  line()
  line("| Bild | n | Median | 95 % | Maximum | Anteil < 0,5 mm |")
  line("|---|---|---|---|---|---|")
  for (const [key, values] of drawn.values) {
    const s = summarize(values)
    out.push(
      `${summaryRow(key, s)} ${percent(values.filter((d) => d < 0.5).length / values.length)} |`
    )
  }
  line()
  line("| Teiler aus den Marken, 1/100 mm | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of markTeiler.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("Über alle Bilder der eigenen Ausdrucke:")
  line()
  line("| Marken und Rahmen | Anzahl |")
  line("|---|---|")
  for (const row of markOutside.lines()) out.push(row)
  line()
  line("| Breite des Rahmens in mm | Bilder | kleinste | Median | größte |")
  line("|---|---|---|---|---|")
  for (const [key, values] of frameMm.values)
    out.push(
      `| ${key} | ${values.length} | ${Math.min(...values).toFixed(0)} | ${summarize(values).median!.toFixed(0)} | ${Math.max(...values).toFixed(0)} |`
    )
  line()
  line("| mm je Punkt der Zeichnung | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of resolution.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("| Nummern und Marken | Anzahl |")
  line("|---|---|")
  for (const row of labelTally.lines()) out.push(row)
  line()
  line("## Je Ausdruck")
  line()
  line(
    "| # | Layout | Modus | Schüsse / roh | Werte gleich | Innenzehner gleich | Summen gleich | Teiler gleich | Lage max. mm | Trefferkreis | Bild max. mm |"
  )
  line("|---|---|---|---|---|---|---|---|---|---|---|")
  for (const row of table) out.push(row)

  mkdirSync(REPORT_DIR, { recursive: true })
  const file = join(REPORT_DIR, `gegenprobe-${today}.md`)
  writeFileSync(file, `${out.join("\n")}\n`)
  process.stdout.write(
    `${files.length} PDFs, ${own.length} eigene, ${pairs.length} Paare → ${file}\n`
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
