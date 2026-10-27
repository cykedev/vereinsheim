// Gegenprobe 1c-0: Was ein Meyton-Ausdruck zeigt, gemessen an den Rohdaten derselben Scheibe in der lokalen
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
import { readPrintoutValues, type PrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
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
  fitDrawn,
  HIT_CIRCLE_CANDIDATES,
  hitCircleCandidates,
  nearestCandidate,
  ringDiametersMm,
  scaleFromRings,
  SPREAD_CANDIDATES,
  spreadCandidates,
  summarize,
  type RawShot,
  type Summary,
} from "./printout-check/compare"

const REPORT_DIR = resolve(__dirname, "../../../reports/tis-1c0")

interface ReadFile {
  values: PrintoutValues
  hex: string | null
  printedAtMs: number | null
  producer: string | null
}

interface Candidate {
  startedAt: Date
  targetId: string | null
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

const round1 = (value: number) => Math.round(value * 10) / 10
const trunc1 = (value: number) => Math.trunc(value * 10 + 1e-9) / 10
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9

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
      discipline: { select: { targetId: true } },
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
            },
          },
        },
      },
    },
  })
  const byId = new Map<number, Candidate[]>()
  for (const card of cards) {
    const shots = card.currentRevision?.shots ?? []
    const pick = (stellung: (n: number) => boolean) =>
      shots.filter((s) => stellung(s.stellung)).map(rawShot)
    const probe = pick((n) => n === 0)
    const scored = pick((n) => n !== 0)
    if (probe.includes(null) || scored.includes(null)) continue
    const list = byId.get(card.scheibenId!) ?? []
    list.push({
      startedAt: card.startedAt,
      targetId: card.discipline.targetId,
      probe: probe as RawShot[],
      scored: scored as RawShot[],
    })
    byId.set(card.scheibenId!, list)
  }
  return { byId, timeZone: site.timeZone, accountCards: cards.length }
}

/** Probe- oder Wertungsschüsse, wie der Modus beim Druck sagt; ohne klaren Modus die, deren Werte passen */
function shownShots(values: PrintoutValues, card: Candidate): { shots: RawShot[]; by: string } {
  const mode = values.mode ?? ""
  if (/probe/i.test(mode)) return { shots: card.probe, by: "Modus Probe → Probeschüsse" }
  if (/wertung/i.test(mode)) return { shots: card.scored, by: "Modus Wertung → Wertungsschüsse" }
  const fits = (shots: RawShot[]) => compareShots(values.shots, shots).valueEqual
  return fits(card.probe) > fits(card.scored)
    ? { shots: card.probe, by: `Modus ${mode || "–"} → Probeschüsse (Werte passen)` }
    : { shots: card.scored, by: `Modus ${mode || "–"} → Wertungsschüsse (Werte passen)` }
}

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
        hex: printout.id.kind === "found" ? printout.id.hex : null,
        printedAtMs: printout.createdAt?.epochMs ?? null,
        producer: printout.producer,
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

  const db = createPrismaClient(url)
  const decode = (hex: string) => {
    const unsigned = Number.parseInt(hex, 16)
    return unsigned >= 0x8000_0000 ? unsigned - 0x1_0000_0000 : unsigned
  }
  const ids = [...new Set(own.flatMap((r) => (r.hex ? [decode(r.hex)] : [])))]
  const { byId, timeZone, accountCards } = await candidates(db, email, ids)
  await db.$disconnect()

  // Abdeckung (Frage 6)
  const coverage = new Tally()
  const layouts = new Tally()
  const disciplines = new Tally()
  const modes = new Tally()
  const drawings = new Tally()
  const producers = new Tally()
  const missingFields = new Tally()
  for (const r of own) {
    layouts.add(layoutOf(r.values))
    disciplines.add(r.values.discipline ?? "–")
    modes.add(r.values.mode ?? "–")
    drawings.add(drawingOf(r.values))
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
    if (!r.hex) {
      coverage.add("ohne ID im Fuß")
      continue
    }
    const list = byId.get(decode(r.hex))
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

  // Frage 1: Werte, Summen
  const shotRatio = new Ratio()
  const sumRatio = new Ratio()
  const selection = new Tally()
  let partial = 0
  // Frage 2: Teiler
  const teilerRatio = new Ratio()
  const teilerDiff = new Samples()
  // Frage 3: Trefferlage
  const centerRatio = new Ratio()
  const centerDist = new Samples()
  // Frage 4: Trefferkreis, Streuwert
  const circleDiff = new Samples()
  const circleNearest = new Tally()
  const spreadDiff = new Samples()
  // Frage 5: Trefferbild
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
    shotRatio.addCounts("Werte je Schuss (Zehntel)", shots.valueEqual, shots.compared)
    shotRatio.addCounts("Innenzehner je Schuss", shots.innerTenEqual, shots.compared)
    if (shots.teilerCompared > 0)
      shotRatio.addCounts(
        "Teiler je Schuss (ganze 1/100 mm, gerundet)",
        shots.teilerEqual,
        shots.teilerCompared
      )
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
        const decimals = row.kind === "best"
        const asRounded = same(check.printed, decimals ? round1(check.raw) : Math.round(check.raw))
        const asTruncated = same(
          check.printed,
          decimals ? trunc1(check.raw) : Math.trunc(check.raw)
        )
        teilerRatio.add(`${row.label}: = gerundet`, asRounded)
        teilerRatio.add(`${row.label}: = abgeschnitten`, asTruncated)
        teilerRatio.add(`${row.label}: Rang stimmt`, check.rankOk)
        teilerDiff.add(row.label, check.diff ?? 0)
        if ((asRounded || asTruncated) && check.rankOk) teilerOk++
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
      `| ${pair.n} | ${layoutOf(v)} | ${v.mode ?? "–"} | ${shots.compared} / ${raw.length} | ${shots.valueEqual} | ${shots.innerTenEqual} | ${sums.filter((s) => s.printed === s.raw).length} / ${sums.length} | ${teilerOk} / ${teilerAll} | ${num(centerWorst, 3)} | ${circleBest} | ${num(drawnWorst, 3)} |`
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
  line("## Abdeckung (Frage 6)")
  line()
  line("| | Anzahl |")
  line("|---|---|")
  line(`| PDFs im Ordner | ${files.length} |`)
  line(`| nicht lesbar | ${unreadable} |`)
  line(`| eigene (häufigster Name) | ${own.length} |`)
  line(`| anderer Name | ${otherName} |`)
  line(`| ohne Name | ${noName} |`)
  line(`| Scheiben des Kontos zu diesen IDs | ${accountCards} |`)
  for (const row of coverage.lines()) out.push(row)
  for (const [title, tally] of [
    ["Layout", layouts],
    ["Erzeuger", producers],
    ["Disziplin", disciplines],
    ["Modus", modes],
    ["Trefferbild", drawings],
    ["fehlt im eigenen Ausdruck", missingFields],
  ] as const) {
    line()
    line(`| ${title} | Ausdrucke |`)
    line("|---|---|")
    for (const row of tally.lines()) out.push(row)
  }
  line()
  line("## Werte je Schuss, Serien, Ergebnis (Frage 1)")
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
  line("## Teiler (Frage 2)")
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
  line("## Trefferlage (Frage 3)")
  line()
  line("| Angabe | gleich / verglichen | Anteil |")
  line("|---|---|---|")
  for (const row of centerRatio.lines()) out.push(row)
  line()
  line("| Abstand gedruckt zu Schwerpunkt | n | Median | 95 % | Maximum |")
  line("|---|---|---|---|---|")
  for (const [key, values] of centerDist.values) out.push(summaryRow(key, summarize(values)))
  line()
  line("## Trefferkreis und Streuwert (Frage 4)")
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
  line("## Trefferbild (Frage 5)")
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
